import { elements } from './elements.js';
import { applyFilters, filtersApplied } from './filters.js';
import { state } from './state.js';
import { formatLabel, getInitial, getRarityKey, getStarLevel, renderStars } from './utils.js';
import { openDetail } from './detail.js';

const getAuthMessage = () => {
  const { auth } = state;
  if (!auth) return '';
  if (auth.error) {
    return auth.error;
  }
  switch (auth.status) {
    case 'loading':
      return 'Anmeldung wird geladen…';
    case 'signing-in':
      return 'Weiterleitung zu Discord…';
    case 'signing-out':
      return 'Abmeldung läuft…';
    default:
      return '';
  }
};

const updateAuthControls = () => {
  const auth = state.auth ?? {};
  const profile = auth.profile ?? null;
  const status = auth.status ?? 'idle';
  const statusMessage = getAuthMessage();
  const hasProfile = Boolean(profile);
  const isBusy = status === 'loading' || status === 'signing-in' || status === 'signing-out';
  const menuOpen = Boolean(auth.menuOpen);

  const authPanel = elements.authPanel;
  if (authPanel) {
    authPanel.dataset.authState = hasProfile ? 'authenticated' : 'anonymous';
    authPanel.dataset.authMenu = hasProfile && menuOpen && !isBusy ? 'open' : 'closed';
  }

  const loginButton = elements.authLoginButton;
  if (loginButton) {
    const loginText = status === 'signing-in' ? 'Weiterleitung…' : 'Mit Discord anmelden';
    const disableLogin = status === 'loading' || status === 'signing-in' || status === 'signing-out';
    loginButton.hidden = false;
    loginButton.disabled = disableLogin;
    loginButton.tabIndex = disableLogin ? -1 : 0;
    loginButton.setAttribute('aria-hidden', 'false');
    loginButton.setAttribute('aria-busy', disableLogin ? 'true' : 'false');
    loginButton.setAttribute('aria-expanded', hasProfile && menuOpen && !disableLogin ? 'true' : 'false');
    loginButton.setAttribute('aria-haspopup', hasProfile ? 'menu' : 'false');
    loginButton.setAttribute('aria-label', hasProfile ? 'Account-Optionen anzeigen' : loginText);
    loginButton.title = hasProfile ? 'Account-Optionen anzeigen' : loginText;
    const loginLabel = loginButton.querySelector('.auth-panel__login-text');
    if (loginLabel) {
      loginLabel.textContent = loginText;
    } else {
      loginButton.textContent = loginText;
    }
  }

  const authMenu = elements.authMenu;
  if (authMenu) {
    const shouldShowMenu = hasProfile && menuOpen && !isBusy;
    authMenu.hidden = !shouldShowMenu;
    authMenu.setAttribute('aria-hidden', shouldShowMenu ? 'false' : 'true');
  }

  const profileButton = elements.authProfileButton;
  if (profileButton) {
    const canUseProfile = hasProfile && !isBusy;
    profileButton.disabled = !canUseProfile;
    profileButton.setAttribute('aria-disabled', canUseProfile ? 'false' : 'true');
    profileButton.tabIndex = canUseProfile ? 0 : -1;
  }

  const userName = elements.authUserName;
  const userAvatarWrapper = elements.authUserAvatar;
  const userAvatarImage = elements.authUserAvatarImage;
  if (userName) {
    userName.textContent = hasProfile ? profile.displayName : '';
  }
  if (userAvatarWrapper) {
    const avatarUrl = hasProfile && profile.avatarUrl ? profile.avatarUrl : '';
    if (userAvatarImage) {
      if (avatarUrl) {
        userAvatarImage.src = avatarUrl;
        userAvatarImage.alt = `Profilbild von ${profile.displayName}`;
        userAvatarImage.hidden = false;
      } else {
        userAvatarImage.src = '';
        userAvatarImage.alt = '';
        userAvatarImage.hidden = true;
      }
    }
    const fallback = userAvatarWrapper.querySelector('.auth-panel__avatar-fallback');
    if (hasProfile) {
      const initial = getInitial(profile.displayName);
      userAvatarWrapper.dataset.initial = initial;
      if (fallback instanceof HTMLElement) {
        fallback.textContent = initial;
      }
      userAvatarWrapper.hidden = false;
    } else {
      delete userAvatarWrapper.dataset.initial;
      if (fallback instanceof HTMLElement) {
        fallback.textContent = '';
      }
      userAvatarWrapper.hidden = true;
    }
  }

  const logoutButton = elements.authLogoutButton;
  if (logoutButton) {
    const isSigningOut = status === 'signing-out';
    const isAvailable = hasProfile && !isBusy;
    logoutButton.disabled = !isAvailable || isSigningOut;
    logoutButton.setAttribute('aria-hidden', isAvailable ? 'false' : 'true');
    logoutButton.tabIndex = isAvailable ? 0 : -1;
    logoutButton.setAttribute('aria-busy', isSigningOut ? 'true' : 'false');
    logoutButton.textContent = isSigningOut ? 'Logout…' : 'Logout';
  }

  const statusElement = elements.authStatus;
  if (statusElement) {
    if (statusMessage) {
      statusElement.textContent = statusMessage;
      statusElement.hidden = false;
    } else {
      statusElement.textContent = '';
      statusElement.hidden = true;
    }
  }

  const addItemButton = elements.addItemButton;
  if (addItemButton) {
    const canAdd = Boolean(profile);
    addItemButton.disabled = !canAdd;
    addItemButton.setAttribute('aria-disabled', canAdd ? 'false' : 'true');
    if (!canAdd) {
      addItemButton.title = 'Bitte melde dich mit Discord an, um Items hinzuzufügen.';
      addItemButton.dataset.authRequired = 'true';
    } else {
      addItemButton.title = 'Neues Item hinzufügen';
      delete addItemButton.dataset.authRequired;
    }
  }
};

export const updateStatusMessage = () => {
  const info = elements.resultInfo;
  if (!info) return;

  let message = '';

  if (state.error) {
    message = state.error;
  } else {
    const source = state.mode === 'search' ? state.searchResults : state.items;
    const filtered = applyFilters(source);
    const filterActive = filtersApplied();

    if (state.loading && source.length === 0) {
      message = 'Lade Items…';
    } else if (source.length === 0) {
      if (state.mode === 'search') {
        const query = state.searchQuery.trim();
        message = query ? `Keine Treffer für „${query}“.` : 'Keine Treffer gefunden.';
      } else {
        message = 'Noch keine Items vorhanden.';
      }
    } else if (filtered.length === 0) {
      message = filterActive ? 'Keine Items für die aktuellen Filter.' : 'Keine Items gefunden.';
    } else if (state.mode === 'search') {
      const query = state.searchQuery.trim();
      const suffix = filterActive ? ' (gefiltert)' : '';
      message = `${filtered.length} Treffer${query ? ` für „${query}“` : ''}${suffix}.`;
    } else {
      const label = filtered.length === 1 ? 'Item' : 'Items';
      message = filterActive
        ? `${filtered.length} von ${source.length} ${label} nach Filtern.`
        : `${filtered.length} ${label} geladen.`;
    }
  }

  if (state.loading && message && message !== 'Lade Items…' && !state.error) {
    message = `${message} (aktualisiere…)`;
  }

  info.textContent = message;
};

export const updateLoadMoreButton = () => {
  const button = elements.loadMoreButton;
  if (!button) return;
  const hasMore = state.mode === 'search' ? state.searchHasMore : state.hasMore;
  if (!hasMore) {
    button.hidden = true;
    button.disabled = true;
    return;
  }
  button.hidden = false;
  button.disabled = state.loading;
  button.textContent = state.loading ? 'Lädt…' : 'Mehr laden';
};

const createCard = (item) => {
  const id = item?.id;
  const wrapper = document.createElement('div');
  wrapper.setAttribute('role', 'listitem');

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'item-card';
  if (id) {
    card.dataset.itemId = id;
  }

  const media = document.createElement('figure');
  media.className = 'item-card__media';
  const img = document.createElement('img');
  const placeholder = document.createElement('div');
  placeholder.className = 'item-card__placeholder';

  const imageUrl = typeof item?.image_url === 'string' ? item.image_url.trim() : '';
  if (imageUrl) {
    img.src = imageUrl;
    img.alt = item?.name ? `Bild von ${item.name}` : 'Item Bild';
  } else {
    media.dataset.empty = 'true';
    placeholder.textContent = getInitial(item?.name);
    img.alt = '';
  }

  media.appendChild(img);
  media.appendChild(placeholder);

  const body = document.createElement('div');
  body.className = 'item-card__body';

  const title = document.createElement('h3');
  title.className = 'item-card__title';
  title.textContent = item?.name ?? 'Unbekanntes Item';

  const meta = document.createElement('div');
  meta.className = 'item-card__meta';

  const rarity = document.createElement('span');
  rarity.className = 'rarity-badge';
  const rarityValue = getRarityKey(item?.rarity);
  if (rarityValue) {
    rarity.dataset.rarity = rarityValue;
  } else {
    delete rarity.dataset.rarity;
  }
  rarity.textContent = formatLabel(item?.rarity);

  const type = document.createElement('span');
  type.className = 'item-card__type';
  type.textContent = formatLabel(item?.type);

  meta.append(rarity, type);

  const stars = document.createElement('div');
  stars.className = 'item-card__stars';
  renderStars(stars, getStarLevel(item));

  body.append(title, meta, stars);
  card.append(media, body);

  card.addEventListener('click', () => {
    if (id) {
      openDetail(id);
    }
  });

  wrapper.appendChild(card);
  return wrapper;
};

const renderGrid = () => {
  const grid = elements.cardGrid;
  if (!grid) return;
  const source = state.mode === 'search' ? state.searchResults : state.items;
  const filtered = applyFilters(source);
  delete grid.dataset.state;
  grid.innerHTML = '';

  if (!filtered.length) {
    grid.dataset.state = 'empty';
    const message = document.createElement('p');
    message.className = 'empty-message';
    if (state.loading && source.length === 0) {
      message.textContent = 'Lade Items…';
    } else if (state.error) {
      message.textContent = state.error;
    } else if (filtersApplied() && source.length > 0) {
      message.textContent = 'Keine Items für die aktuellen Filter.';
    } else if (state.mode === 'search') {
      const query = state.searchQuery.trim();
      message.textContent = query ? `Keine Treffer für „${query}“.` : 'Keine Treffer gefunden.';
    } else {
      message.textContent = 'Noch keine Items vorhanden.';
    }
    grid.appendChild(message);
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((item) => {
    fragment.appendChild(createCard(item));
  });
  grid.appendChild(fragment);
};

export const render = () => {
  renderGrid();
  updateStatusMessage();
  updateLoadMoreButton();
  updateAuthControls();
};

export const setLoading = (value) => {
  state.loading = value;
  updateLoadMoreButton();
  updateStatusMessage();
};
