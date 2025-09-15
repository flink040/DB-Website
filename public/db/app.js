const PAGE_SIZE = 12;

const elements = {
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  rarityFilter: document.getElementById('rarityFilter'),
  resultInfo: document.getElementById('resultInfo'),
  cardGrid: document.getElementById('cardGrid'),
  loadMoreButton: document.getElementById('loadMoreButton'),
  detailView: document.getElementById('detailView'),
  detailMedia: document.getElementById('detailMedia'),
  detailImage: document.getElementById('detailImage'),
  detailFallback: document.getElementById('detailFallback'),
  detailTitle: document.getElementById('detailTitle'),
  detailSubtitle: document.getElementById('detailSubtitle'),
  detailStars: document.getElementById('detailStars'),
  detailRarity: document.getElementById('detailRarity'),
  detailType: document.getElementById('detailType'),
  detailReleaseRelative: document.getElementById('detailReleaseRelative'),
  detailReleaseAbsolute: document.getElementById('detailReleaseAbsolute'),
  detailDescriptionSection: document.getElementById('detailDescriptionSection'),
  detailDescription: document.getElementById('detailDescription'),
  detailPropertiesSection: document.getElementById('detailPropertiesSection'),
  detailProperties: document.getElementById('detailProperties'),
  detailEnchantmentsSection: document.getElementById('detailEnchantmentsSection'),
  detailEnchantments: document.getElementById('detailEnchantments'),
  detailStatus: document.getElementById('detailStatus')
};

const state = {
  mode: 'list',
  items: [],
  nextCursor: null,
  hasMore: false,
  searchResults: [],
  searchHasMore: false,
  searchQuery: '',
  searchPage: 0,
  filters: {
    type: '',
    rarity: ''
  },
  loading: false,
  error: '',
  lastListToken: 0,
  lastSearchToken: 0,
  detailToken: 0,
  activeDetailId: null,
  lastFocusedElement: null
};

const debounce = (fn, delay = 300) => {
  let timer = null;
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(null, args), delay);
  };
  debounced.cancel = () => {
    window.clearTimeout(timer);
  };
  return debounced;
};

const filtersApplied = () => Boolean(state.filters.type || state.filters.rarity);

const normalizeFilterValue = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const formatLabel = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return 'Unbekannt';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getStarLevel = (item) => {
  const candidates = [item?.star_level, item?.starLevel, item?.stars, item?.starlevel];
  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num >= 0) {
      return num;
    }
  }
  return 0;
};

const getInitial = (value) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().charAt(0).toUpperCase();
  }
  return '★';
};

const renderStars = (container, value) => {
  if (!container) return;
  const maxVisual = 5;
  const total = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const clamped = Math.min(total, maxVisual);
  const filled = Array.from({ length: clamped }, () => '★');
  const empty = Array.from({ length: maxVisual - clamped }, () => '☆');
  container.dataset.count = String(total);
  container.textContent = [...filled, ...empty].join(' ');
  const ariaLabel = total === 0 ? 'Keine Sterne vergeben' : `${total} ${total === 1 ? 'Stern' : 'Sterne'}`;
  container.setAttribute('aria-label', ariaLabel);
  if (total > maxVisual) {
    container.textContent += ` +${total - maxVisual}`;
  }
};

const applyFilters = (items) => {
  const typeFilter = normalizeFilterValue(state.filters.type);
  const rarityFilter = normalizeFilterValue(state.filters.rarity);

  if (!typeFilter && !rarityFilter) return items;

  return items.filter((item) => {
    const itemType = normalizeFilterValue(item?.type);
    const itemRarity = normalizeFilterValue(item?.rarity);
    const matchesType = !typeFilter || itemType === typeFilter;
    const matchesRarity = !rarityFilter || itemRarity === rarityFilter;
    return matchesType && matchesRarity;
  });
};

const updateStatusMessage = () => {
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

const updateLoadMoreButton = () => {
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
  const rarityValue = normalizeFilterValue(item?.rarity);
  rarity.dataset.rarity = rarityValue;
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

const render = () => {
  renderGrid();
  updateStatusMessage();
  updateLoadMoreButton();
};

const setLoading = (value) => {
  state.loading = value;
  updateLoadMoreButton();
  updateStatusMessage();
};

const loadItems = async ({ reset = false } = {}) => {
  const token = ++state.lastListToken;

  if (reset) {
    state.items = [];
    state.nextCursor = null;
    state.hasMore = false;
    render();
  }

  setLoading(true);

  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  if (!reset && state.nextCursor) {
    params.set('cursor', state.nextCursor);
  }

  try {
    const response = await fetch(`/api/items?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (token !== state.lastListToken) return;

    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.items = reset ? items : [...state.items, ...items];
    state.nextCursor = payload?.nextCursor ?? null;
    state.hasMore = Boolean(payload?.nextCursor);
    state.error = '';
  } catch (error) {
    if (token === state.lastListToken) {
      if (reset) {
        state.items = [];
      }
      state.hasMore = false;
      state.error = 'Items konnten nicht geladen werden.';
      console.error(error);
    }
  } finally {
    if (token === state.lastListToken) {
      setLoading(false);
      render();
    }
  }
};

const searchItems = async ({ page, reset }) => {
  const query = state.searchQuery.trim();
  if (!query) return;
  const token = ++state.lastSearchToken;

  if (reset) {
    state.searchResults = [];
    state.searchHasMore = false;
    render();
  }

  setLoading(true);

  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', String(PAGE_SIZE * page));

  try {
    const response = await fetch(`/api/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (token !== state.lastSearchToken) return;

    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.searchResults = items;
    const count = Number(payload?.count ?? items.length);
    state.searchHasMore = Number.isFinite(count) ? count >= PAGE_SIZE * page : items.length >= PAGE_SIZE * page;
    state.searchPage = page;
    state.error = '';
  } catch (error) {
    if (token === state.lastSearchToken) {
      if (reset) {
        state.searchResults = [];
        state.searchPage = 0;
      }
      state.searchHasMore = false;
      state.error = 'Suche fehlgeschlagen.';
      console.error(error);
    }
  } finally {
    if (token === state.lastSearchToken) {
      setLoading(false);
      render();
    }
  }
};

const triggerSearch = (reset) => {
  const query = state.searchQuery.trim();
  if (!query) return;
  const nextPage = reset ? 1 : state.searchPage + 1;
  searchItems({ page: nextPage, reset });
};

const formatRelativeDate = (input) => {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const seconds = Math.round(diff / 1000);
  const rtf = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });

  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' }
  ];

  let duration = seconds;
  let unit = 'second';

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      unit = division.unit;
      break;
    }
    duration /= division.amount;
  }

  duration = Math.round(duration);
  return rtf.format(duration, unit);
};

const formatAbsoluteDate = (input) => {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const formatFieldLabel = (key) => {
  if (!key) return '';
  if (key.toLowerCase() === 'id') return 'ID';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (value instanceof Date) return formatAbsoluteDate(value.toISOString());
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
      .join(', ');
  }
  if (typeof value === 'object') {
    return '';
  }
  return String(value);
};

const resolveEnchantmentName = (enchantment) => {
  if (!enchantment || typeof enchantment !== 'object') return 'Unbekannte Verzauberung';
  const candidates = [
    enchantment.display_name,
    enchantment.localized_name,
    enchantment.translation,
    enchantment.name,
    enchantment.title
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return 'Unbekannte Verzauberung';
};

const resolveEnchantmentLevel = (enchantment) => {
  if (!enchantment || typeof enchantment !== 'object') return null;
  const direct = enchantment.level ?? enchantment.current_level ?? enchantment.lvl;
  const candidate = Number(direct);
  if (Number.isFinite(candidate)) return candidate;
  for (const [key, value] of Object.entries(enchantment)) {
    const lower = key.toLowerCase();
    if (!lower.includes('level') || lower.includes('max')) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (enchantment?.pivot && typeof enchantment.pivot === 'object') {
    const pivotLevel = Number(enchantment.pivot.level ?? enchantment.pivot.current_level);
    if (Number.isFinite(pivotLevel)) return pivotLevel;
  }
  return null;
};

const populateProperties = (item) => {
  const container = elements.detailProperties;
  const section = elements.detailPropertiesSection;
  if (!container || !section) return;
  container.innerHTML = '';

  const entries = Object.entries(item ?? {})
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === '') return false;
      const normalized = key.toLowerCase();
      if (
        [
          'image_url',
          'enchantments',
          'item_enchantments',
          'price',
          'description',
          'released_at',
          'release_date',
          'name'
        ].includes(normalized)
      )
        return false;
      if (typeof value === 'object' && !Array.isArray(value)) return false;
      return true;
    });

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'detail-status';
    empty.textContent = 'Keine zusätzlichen Eigenschaften.';
    container.appendChild(empty);
    section.hidden = false;
    return;
  }

  entries.forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'detail-list__row';
    const dt = document.createElement('dt');
    dt.textContent = formatFieldLabel(key);
    const dd = document.createElement('dd');
    dd.textContent = formatValue(value);
    row.append(dt, dd);
    container.appendChild(row);
  });
  section.hidden = false;
};

const populateEnchantments = (enchantments) => {
  const section = elements.detailEnchantmentsSection;
  const list = elements.detailEnchantments;
  if (!section || !list) return;
  list.innerHTML = '';

  if (!Array.isArray(enchantments) || enchantments.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'detail-enchantments__empty';
    empty.textContent = 'Keine Verzauberungen vorhanden.';
    list.appendChild(empty);
    section.hidden = false;
    return;
  }

  enchantments.forEach((enchantment) => {
    const item = document.createElement('li');
    item.className = 'detail-enchantments__item';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = resolveEnchantmentName(enchantment);
    const levelSpan = document.createElement('span');
    levelSpan.className = 'detail-enchantments__level';
    const level = resolveEnchantmentLevel(enchantment);
    levelSpan.textContent = level ? `Lvl ${level}` : 'Lvl ?';
    item.append(nameSpan, levelSpan);
    list.appendChild(item);
  });
  section.hidden = false;
};

const setDetailStatus = (message) => {
  const status = elements.detailStatus;
  if (!status) return;
  status.textContent = message ?? '';
};

const setDetailMedia = (url, name) => {
  const figure = elements.detailMedia;
  const image = elements.detailImage;
  const fallback = elements.detailFallback;
  if (!figure || !image || !fallback) return;

  const cleaned = typeof url === 'string' ? url.trim() : '';
  if (cleaned) {
    image.src = cleaned;
    image.alt = name ? `Bild von ${name}` : 'Item Bild';
    fallback.textContent = '';
    delete figure.dataset.empty;
  } else {
    image.removeAttribute('src');
    image.alt = '';
    fallback.textContent = getInitial(name);
    figure.dataset.empty = 'true';
  }
};

const populateDetail = (item) => {
  elements.detailTitle.textContent = item?.name ?? 'Unbekanntes Item';

  const subtitleParts = [];
  if (item?.rarity) subtitleParts.push(formatLabel(item.rarity));
  if (item?.type) subtitleParts.push(formatLabel(item.type));
  elements.detailSubtitle.textContent = subtitleParts.length ? subtitleParts.join(' • ') : 'Itemdetails';

  elements.detailType.textContent = formatLabel(item?.type);
  elements.detailRarity.textContent = formatLabel(item?.rarity);

  const releaseSource = item?.released_at ?? item?.release_date;
  const releaseRelative = formatRelativeDate(releaseSource);
  const releaseAbsolute = formatAbsoluteDate(releaseSource);
  elements.detailReleaseRelative.textContent = releaseRelative ?? 'Unbekannt';
  elements.detailReleaseAbsolute.textContent = releaseAbsolute ? `(${releaseAbsolute})` : '';

  renderStars(elements.detailStars, getStarLevel(item));
  setDetailMedia(item?.image_url, item?.name);

  if (item?.description) {
    elements.detailDescription.textContent = item.description;
    elements.detailDescriptionSection.hidden = false;
  } else {
    elements.detailDescription.textContent = '';
    elements.detailDescriptionSection.hidden = true;
  }

  populateProperties(item);
  populateEnchantments(item?.enchantments);
  setDetailStatus('');
};

const getFocusableElements = (container) => {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
};

const openDetail = (id) => {
  if (!id) return;
  const view = elements.detailView;
  if (!view) return;

  state.detailToken += 1;
  const token = state.detailToken;
  state.activeDetailId = id;
  state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  view.hidden = false;
  view.setAttribute('aria-hidden', 'false');
  document.body.dataset.detailOpen = 'true';
  setDetailStatus('Lade Details…');
  elements.detailProperties.innerHTML = '';
  elements.detailEnchantments.innerHTML = '';
  if (elements.detailPropertiesSection) {
    elements.detailPropertiesSection.hidden = true;
  }
  if (elements.detailEnchantmentsSection) {
    elements.detailEnchantmentsSection.hidden = true;
  }
  if (elements.detailDescriptionSection) {
    elements.detailDescriptionSection.hidden = true;
    elements.detailDescription.textContent = '';
  }

  const focusable = getFocusableElements(view);
  const firstFocusable = focusable[0];
  if (firstFocusable) {
    firstFocusable.focus({ preventScroll: true });
  }

  fetchDetail(id, token);
};

const fetchDetail = async (id, token) => {
  try {
    const response = await fetch(`/api/items/${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (token !== state.detailToken) return;

    const item = payload?.item ?? payload?.data?.item ?? null;
    if (!item) {
      throw new Error('Ungültige Antwort');
    }
    populateDetail(item);
  } catch (error) {
    if (token === state.detailToken) {
      console.error(error);
      setDetailStatus('Details konnten nicht geladen werden.');
    }
  }
};

const closeDetail = () => {
  const view = elements.detailView;
  if (!view || view.getAttribute('aria-hidden') === 'true') return;
  state.detailToken += 1;
  state.activeDetailId = null;
  view.setAttribute('aria-hidden', 'true');
  view.hidden = true;
  delete document.body.dataset.detailOpen;
  setDetailStatus('');
  if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
    state.lastFocusedElement.focus({ preventScroll: true });
  }
};

const handleDetailKeydown = (event) => {
  const view = elements.detailView;
  if (!view || view.getAttribute('aria-hidden') === 'true') return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDetail();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements(view);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const initializeEvents = () => {
  if (elements.searchForm) {
    elements.searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
    });
  }

  const debouncedSearch = debounce(() => {
    state.mode = 'search';
    triggerSearch(true);
  }, 350);

  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (event) => {
      const value = event.target.value;
      state.searchQuery = value;
      if (value.trim()) {
        state.mode = 'search';
        debouncedSearch();
      } else {
        debouncedSearch.cancel();
        state.mode = 'list';
        state.lastSearchToken += 1;
        state.searchResults = [];
        state.searchHasMore = false;
        state.searchPage = 0;
        state.error = '';
        render();
        if (state.items.length === 0 && !state.loading) {
          loadItems({ reset: true });
        }
      }
      updateStatusMessage();
    });
  }

  if (elements.typeFilter) {
    elements.typeFilter.addEventListener('change', (event) => {
      state.filters.type = event.target.value || '';
      render();
    });
  }

  if (elements.rarityFilter) {
    elements.rarityFilter.addEventListener('change', (event) => {
      state.filters.rarity = event.target.value || '';
      render();
    });
  }

  if (elements.loadMoreButton) {
    elements.loadMoreButton.addEventListener('click', () => {
      if (state.loading) return;
      if (state.mode === 'search') {
        triggerSearch(false);
      } else {
        loadItems({ reset: false });
      }
    });
  }

  const view = elements.detailView;
  if (view) {
    view.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches('[data-close-detail]') || target.closest('[data-close-detail]')) {
        closeDetail();
      }
    });
    view.addEventListener('keydown', handleDetailKeydown);
  }
};

initializeEvents();
render();
loadItems({ reset: true });
