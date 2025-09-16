export const PAGE_SIZE = 12;

const MATERIAL_CONFIG = [
  { value: 'netherite', label: 'Netherite', synonyms: ['netherite', '1'] },
  { value: 'diamond', label: 'Diamant', synonyms: ['diamond', 'diamant', '2'] },
  { value: 'gold', label: 'Gold', synonyms: ['gold', '3'] },
  { value: 'iron', label: 'Eisen', synonyms: ['iron', 'eisen', '4'] },
  { value: 'chain', label: 'Kette', synonyms: ['chain', 'chainmail', 'chain mail', 'kette', '5'] },
  { value: 'leather', label: 'Leder', synonyms: ['leather', 'leder', '6'] },
  {
    value: 'golden horse armor',
    label: 'Golden Horse Armor',
    synonyms: ['golden horse armor', 'golden horse armour', '7']
  },
  { value: 'wood', label: 'Holz', synonyms: ['wood', 'holz', '8'] },
  { value: 'stone', label: 'Stein', synonyms: ['stone', 'stein', '9'] }
];

const normalizeMaterialEntry = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

export const MATERIAL_SYNONYMS = MATERIAL_CONFIG.reduce((acc, { value, synonyms }) => {
  const normalizedValue = normalizeMaterialEntry(value);
  const entries = new Set([normalizedValue]);
  (synonyms ?? []).forEach((entry) => {
    const normalized = normalizeMaterialEntry(entry);
    if (normalized) {
      entries.add(normalized);
    }
  });
  acc[normalizedValue] = Array.from(entries);
  return acc;
}, {});

export const MATERIAL_LABELS = MATERIAL_CONFIG.reduce((acc, { label, value, synonyms }) => {
  const entries = new Set([value, ...(synonyms ?? [])]);
  entries.forEach((entry) => {
    const normalized = normalizeMaterialEntry(entry);
    if (normalized) {
      acc[normalized] = label;
    }
  });
  return acc;
}, {});
