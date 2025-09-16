import { createClient } from '@supabase/supabase-js';
import { state } from './state.js';
import { render } from './render.js';

let configPromise = null;
let clientPromise = null;
let hasStrippedAuthHash = false;

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage
const LOGGED_IN_COOKIE_NAME = 'db_discord_logged_in';
const DISCORD_ID_COOKIE_NAME = 'db_discord_id';

const AUTH_HASH_SENSITIVE_KEYS = [
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'expires_at',
  'expires_in',
  'token_type',
];

const isSecureCookieContext = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const protocol = window.location?.protocol;
  return protocol === 'https:';
};

const writeCookie = (name, value, { maxAge = AUTH_COOKIE_MAX_AGE } = {}) => {
  if (typeof document === 'undefined') {
    return;
  }

  const safeValue = encodeURIComponent(String(value ?? ''));
  const parts = [`${name}=${safeValue}`, 'Path=/'];

  if (Number.isFinite(maxAge)) {
    if (maxAge <= 0) {
      parts.push('Max-Age=0');
      parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    } else {
      parts.push(`Max-Age=${Math.round(maxAge)}`);
    }
  }

  parts.push('SameSite=Lax');

  if (isSecureCookieContext()) {
    parts.push('Secure');
  }

  document.cookie = parts.join('; ');
};

const clearCookie = (name) => writeCookie(name, '', { maxAge: 0 });

const syncAuthCookies = (session, profile) => {
  if (typeof document === 'undefined') {
    return;
  }

  if (session) {
    writeCookie(LOGGED_IN_COOKIE_NAME, 'true');

    const discordId =
      typeof profile?.discordId === 'string' && profile.discordId.trim()
        ? profile.discordId.trim()
        : null;

    if (discordId) {
      writeCookie(DISCORD_ID_COOKIE_NAME, discordId);
    } else {
      clearCookie(DISCORD_ID_COOKIE_NAME);
    }
  } else {
    clearCookie(LOGGED_IN_COOKIE_NAME);
    clearCookie(DISCORD_ID_COOKIE_NAME);
  }
};

const loadConfig = async () => {
  if (!configPromise) {
    configPromise = fetch('/api/auth/config', {
      headers: {
        Accept: 'application/json',
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const message =
            typeof errorBody?.error === 'string' && errorBody.error.trim()
              ? errorBody.error.trim()
              : `Konfiguration konnte nicht geladen werden (HTTP ${response.status}).`;
          throw new Error(message);
        }
        return response.json();
      })
      .then((payload) => {
        const supabaseUrl = typeof payload?.supabaseUrl === 'string' ? payload.supabaseUrl.trim() : '';
        const supabaseAnonKey =
          typeof payload?.supabaseAnonKey === 'string' ? payload.supabaseAnonKey.trim() : '';
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase-Konfiguration ist unvollständig.');
        }
        return {
          supabaseUrl,
          supabaseAnonKey,
          discordRedirectUri:
            typeof payload?.discordRedirectUri === 'string'
              ? payload.discordRedirectUri.trim() || null
              : null,
        };
      })
      .catch((error) => {
        configPromise = null;
        throw error;
      });
  }
  return configPromise;
};

const getClient = async () => {
  if (!clientPromise) {
    clientPromise = loadConfig().then(({ supabaseUrl, supabaseAnonKey }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
        },
      })
    );
  }
  return clientPromise;
};

const mapUserToProfile = (user) => {
  if (!user || typeof user !== 'object') {
    return null;
  }
  const id = typeof user.id === 'string' ? user.id : '';
  if (!id) {
    return null;
  }
  const metadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? user.user_metadata
      : {};
  const candidates = [
    metadata.full_name,
    metadata.name,
    metadata.user_name,
    metadata.preferred_username,
    metadata.custom_claims?.name,
    user.email,
    id,
  ];
  let displayName = 'Unbekannt';
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      displayName = candidate.trim();
      break;
    }
  }
  const avatarUrl =
    typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim()
      ? metadata.avatar_url.trim()
      : null;
  let discordId = null;
  const identities = Array.isArray(user.identities) ? user.identities : [];
  for (const identity of identities) {
    if (identity?.provider === 'discord') {
      const candidate = identity?.identity_data?.id;
      if (typeof candidate === 'string' && candidate.trim()) {
        discordId = candidate.trim();
      }
      break;
    }
  }
  return {
    id,
    displayName,
    avatarUrl,
    discordId,
  };
};

const applyAuthState = (updates) => {
  const authState = state.auth;
  if (!authState) return;
  const previousSession = authState.session;
  const previousProfile = authState.profile;
  if ('status' in updates && updates.status) {
    authState.status = updates.status;
  }
  if ('profile' in updates) {
    authState.profile = updates.profile ?? null;
    if (!updates.profile) {
      authState.menuOpen = false;
    }
  }
  if ('error' in updates) {
    authState.error = updates.error ?? '';
  }
  if ('session' in updates) {
    authState.session = updates.session ?? null;
  }
  if ('menuOpen' in updates) {
    authState.menuOpen = Boolean(updates.menuOpen);
  }

  const sessionChanged = 'session' in updates && authState.session !== previousSession;
  const profileChanged = 'profile' in updates && authState.profile !== previousProfile;

  if (sessionChanged || profileChanged) {
    syncAuthCookies(authState.session, authState.profile);
  }

  render();
};

const stripAuthHashFromLocation = () => {
  if (hasStrippedAuthHash) {
    return;
  }
  hasStrippedAuthHash = true;

  if (typeof window === 'undefined' || !window.location) {
    return;
  }

  const rawHash = window.location.hash;
  if (typeof rawHash !== 'string' || rawHash.length <= 1) {
    return;
  }

  const trimmedHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  let containsSensitiveAuthData = false;

  try {
    const params = new URLSearchParams(trimmedHash);
    for (const key of AUTH_HASH_SENSITIVE_KEYS) {
      if (params.has(key)) {
        containsSensitiveAuthData = true;
        break;
      }
    }
  } catch (error) {
    const lowerCasedHash = trimmedHash.toLowerCase();
    containsSensitiveAuthData =
      lowerCasedHash.includes('access_token=') ||
      lowerCasedHash.includes('refresh_token=') ||
      lowerCasedHash.includes('provider_token=');
  }

  if (!containsSensitiveAuthData) {
    return;
  }

  if (typeof window.history?.replaceState === 'function') {
    const newUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, document.title, newUrl);
  }
};

const syncProfileWithServer = async (session, profile) => {
  const accessToken =
    typeof session?.access_token === 'string' && session.access_token.trim()
      ? session.access_token.trim()
      : '';
  const userId =
    session?.user && typeof session.user.id === 'string' && session.user.id.trim()
      ? session.user.id.trim()
      : '';

  if (!accessToken || !userId) {
    return;
  }

  let discordId = null;
  const candidateDiscordId = profile?.discordId;
  if (typeof candidateDiscordId === 'string' && candidateDiscordId.trim()) {
    discordId = candidateDiscordId.trim();
  }

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId, discordId }),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody.error === 'string' && errorBody.error.trim()) {
          message = errorBody.error.trim();
        }
      } catch (parseError) {
        console.warn('Antwort der Profil-Synchronisierung konnte nicht gelesen werden.', parseError);
      }
      console.warn('Profil konnte nicht mit dem Backend synchronisiert werden.', {
        status: response.status,
        message,
      });
    }
  } catch (error) {
    console.error('Profil konnte nicht mit dem Backend synchronisiert werden.', error);
  }
};

export const initializeAuth = async () => {
  applyAuthState({ status: 'loading', error: '', session: null, profile: null, menuOpen: false });
  let pendingAuthError = '';
  let codeFromQuery = '';
  try {
    if (typeof window !== 'undefined' && window?.location) {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const paramsToDelete = [];
      const rawErrorDescription = params.get('error_description');
      const rawError = params.get('error');
      const trimmedErrorDescription =
        typeof rawErrorDescription === 'string' ? rawErrorDescription.trim() : '';
      const trimmedError = typeof rawError === 'string' ? rawError.trim() : '';
      if (trimmedErrorDescription) {
        pendingAuthError = trimmedErrorDescription;
      } else if (trimmedError) {
        pendingAuthError = trimmedError;
      }
      if (rawErrorDescription !== null) {
        paramsToDelete.push('error_description');
      }
      if (rawError !== null) {
        paramsToDelete.push('error');
      }
      const rawCode = params.get('code');
      if (typeof rawCode === 'string' && rawCode.trim()) {
        codeFromQuery = rawCode.trim();
        paramsToDelete.push('code');
      }
      if (pendingAuthError) {
        applyAuthState({ error: pendingAuthError, menuOpen: false });
      }
      if (paramsToDelete.length && typeof window.history?.replaceState === 'function') {
        paramsToDelete.forEach((name) => params.delete(name));
        const newSearch = params.toString();
        const newUrl = `${url.pathname}${newSearch ? `?${newSearch}` : ''}${url.hash}`;
        window.history.replaceState(window.history.state, document.title, newUrl);
      }
    }
    const client = await getClient();
    let session = null;
    if (codeFromQuery && !state.auth?.session) {
      const { data: exchangeData, error: exchangeError } =
        await client.auth.exchangeCodeForSession(codeFromQuery);
      if (exchangeError) {
        throw exchangeError;
      }
      session = exchangeData?.session ?? null;
    }
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }
    if (sessionData?.session) {
      session = sessionData.session;
    }
    let profile = null;
    if (session?.user) {
      profile = mapUserToProfile(session.user);
    } else if (session) {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) {
        if (userError.message && !/Invalid token/i.test(userError.message)) {
          throw userError;
        }
      }
      profile = mapUserToProfile(userData?.user ?? null);
    }
    const hasSessionOrProfile = Boolean(session) || Boolean(profile);
    const nextErrorMessage = hasSessionOrProfile ? '' : pendingAuthError;
    applyAuthState({
      status: 'ready',
      profile,
      session,
      error: nextErrorMessage,
      menuOpen: false,
    });
    client.auth.onAuthStateChange((_event, nextSession) => {
      const nextProfile = mapUserToProfile(nextSession?.user ?? null);
      const nextError = nextSession ? '' : state.auth?.error ?? '';
      applyAuthState({
        status: 'ready',
        profile: nextProfile,
        session: nextSession ?? null,
        error: nextError,
        menuOpen: false,
      });
      if (nextSession) {
        void syncProfileWithServer(nextSession, nextProfile);
      }
    });
    if (session) {
      await syncProfileWithServer(session, profile);
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Anmeldung konnte nicht initialisiert werden.';
    applyAuthState({
      status: 'error',
      profile: null,
      session: null,
      error: message,
      menuOpen: false,
    });
  } finally {
    stripAuthHashFromLocation();
  }
};

export const signInWithDiscord = async () => {
  const client = await getClient();
  const { discordRedirectUri } = await loadConfig();
  applyAuthState({ status: 'signing-in', error: '', menuOpen: false });
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify email',
        redirectTo: discordRedirectUri || window.location.href,
      },
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Anmeldung mit Discord fehlgeschlagen.';
    applyAuthState({ status: 'ready', error: message, menuOpen: false });
    throw error;
  }
};

export const signOut = async () => {
  const client = await getClient();
  applyAuthState({ status: 'signing-out', menuOpen: false });
  try {
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
    applyAuthState({ status: 'ready', profile: null, session: null, error: '', menuOpen: false });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Abmeldung fehlgeschlagen.';
    applyAuthState({ status: 'ready', error: message, menuOpen: false });
    throw error;
  }
};

export const getCurrentSession = () => state.auth?.session ?? null;

export const getAccessToken = () => {
  const session = getCurrentSession();
  return session?.access_token ?? null;
};
