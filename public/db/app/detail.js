import { elements } from './elements.js';
import { state } from './state.js';
import {
  formatAbsoluteDate,
  formatFieldLabel,
  formatLabel,
  formatRelativeDate,
  formatValue,
  getInitial,
  getStarLevel,
  renderStars,
  resolveEnchantmentLevel,
  resolveEnchantmentName
} from './utils.js';

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

export const openDetail = (id) => {
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

export const closeDetail = () => {
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

export const handleDetailKeydown = (event) => {
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
