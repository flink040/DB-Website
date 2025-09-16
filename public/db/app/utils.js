import { getItemTypeLabel } from './item-types.js';

export const debounce = (fn, delay = 300) => {
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

export const normalizeFilterValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return String(value).trim().toLowerCase();
  }
  return '';
};

const normalizeRarityValue = (value) => {
  const normalized = normalizeFilterValue(value);
  if (!normalized) return '';
  const replaced = normalized
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  const withoutDiacritics = replaced.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return withoutDiacritics.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

const rarityAliasToKey = new Map();
const rarityKeyToLabel = new Map();

const registerRarityAlias = (alias, key) => {
  if (!alias || !key) return;
  const normalized = normalizeRarityValue(alias);
  if (!normalized) return;
  rarityAliasToKey.set(normalized, key);
};

const RARITY_DEFINITIONS = [
  { key: 'selten', label: 'Selten', aliases: ['rare'] },
  { key: 'episch', label: 'Episch', aliases: ['epic'] },
  { key: 'unbezahlbar', label: 'Unbezahlbar', aliases: ['priceless'] },
  { key: 'legendaer', label: 'Legendär', aliases: ['legendary', 'legendär', 'legendar'] },
  { key: 'jackpot', label: 'Jackpot', aliases: [] },
  { key: 'mega-jackpot', label: 'Mega Jackpot', aliases: ['mythic', 'mega jackpot', 'megajackpot', 'mega_jackpot'] },
];

for (const rarity of RARITY_DEFINITIONS) {
  rarityKeyToLabel.set(rarity.key, rarity.label);
  registerRarityAlias(rarity.key, rarity.key);
  registerRarityAlias(rarity.label, rarity.key);
  registerRarityAlias(rarity.label.replace(/\s+/g, ''), rarity.key);
  registerRarityAlias(rarity.label.replace(/\s+/g, '-'), rarity.key);
  if (Array.isArray(rarity.aliases)) {
    for (const alias of rarity.aliases) {
      registerRarityAlias(alias, rarity.key);
    }
  }
}

export const getRarityKey = (value) => {
  const normalized = normalizeRarityValue(value);
  if (!normalized) return '';
  return rarityAliasToKey.get(normalized) ?? normalized;
};

export const getRarityLabel = (value) => {
  const key = getRarityKey(value);
  if (!key) return null;
  return rarityKeyToLabel.get(key) ?? null;
};

export const formatLabel = (value) => {
  const typeLabel = getItemTypeLabel(value);
  if (typeLabel) return typeLabel;

  const rarityLabel = getRarityLabel(value);
  if (rarityLabel) return rarityLabel;

  let normalized = '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    normalized = String(value).trim();
  }

  if (!normalized) return 'Unbekannt';

  const cleaned = normalized.replace(/[_-]+/g, ' ');
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const getStarLevel = (item) => {
  const candidates = [item?.star_level, item?.starLevel, item?.stars, item?.starlevel];
  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num >= 0) {
      return num;
    }
  }
  return 0;
};

export const getInitial = (value) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().charAt(0).toUpperCase();
  }
  return '★';
};

export const renderStars = (container, value) => {
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

export const formatRelativeDate = (input) => {
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

export const formatAbsoluteDate = (input) => {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

export const formatFieldLabel = (key) => {
  if (!key) return '';
  if (key.toLowerCase() === 'id') return 'ID';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const formatValue = (value) => {
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

export const resolveEnchantmentName = (enchantment) => {
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

export const resolveEnchantmentLevel = (enchantment) => {
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
