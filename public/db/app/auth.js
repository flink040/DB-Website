import { createClient } from '@supabase/supabase-js';
import { state } from './state.js';
import { render } from './render.js';

let configPromise = null;
let clientPromise = null;

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
      createClient(supabaseUrl, supabaseAnonKey)
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
  if ('status' in updates && updates.status) {
    authState.status = updates.status;
  }
  if ('profile' in updates) {
    authState.profile = updates.profile ?? null;
  }
  if ('error' in updates) {
    authState.error = updates.error ?? '';
  }
  if ('session' in updates) {
    authState.session = updates.session ?? null;
  }
  render();
};

export const initializeAuth = async () => {
  applyAuthState({ status: 'loading', error: '', session: null, profile: null });
  try {
    const client = await getClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }
    const session = sessionData?.session ?? null;
    let profile = null;
    if (session?.user) {
      profile = mapUserToProfile(session.user);
    } else {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) {
        if (userError.message && !/Invalid token/i.test(userError.message)) {
          throw userError;
        }
      }
      profile = mapUserToProfile(userData?.user ?? null);
    }
    applyAuthState({ status: 'ready', profile, session, error: '' });
    client.auth.onAuthStateChange((_event, nextSession) => {
      const nextProfile = mapUserToProfile(nextSession?.user ?? null);
      applyAuthState({ status: 'ready', profile: nextProfile, session: nextSession ?? null, error: '' });
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Anmeldung konnte nicht initialisiert werden.';
    applyAuthState({ status: 'error', profile: null, session: null, error: message });
  }
};

export const signInWithDiscord = async () => {
  const client = await getClient();
  const { discordRedirectUri } = await loadConfig();
  applyAuthState({ status: 'signing-in', error: '' });
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
    applyAuthState({ status: 'ready', error: message });
    throw error;
  }
};

export const signOut = async () => {
  const client = await getClient();
  applyAuthState({ status: 'signing-out' });
  try {
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
    applyAuthState({ status: 'ready', profile: null, session: null, error: '' });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Abmeldung fehlgeschlagen.';
    applyAuthState({ status: 'ready', error: message });
    throw error;
  }
};

export const getCurrentSession = () => state.auth?.session ?? null;

export const getAccessToken = () => {
  const session = getCurrentSession();
  return session?.access_token ?? null;
};
