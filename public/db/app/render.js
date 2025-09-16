import { elements } from './elements.js';
import { applyFilters, filtersApplied } from './filters.js';
import { state } from './state.js';
import { formatLabel, getInitial, getRarityKey, getStarLevel, renderStars } from './utils.js';
import { openDetail } from './detail.js';

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
};

export const setLoading = (value) => {
  state.loading = value;
  updateLoadMoreButton();
  updateStatusMessage();
};
