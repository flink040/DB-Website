const RAW_ITEM_TYPES = [
  { id: '1', label: 'Helm' },
  { id: '2', label: 'Brustplatte' },
  { id: '3', label: 'Hose' },
  { id: '4', label: 'Schuhe' },
  { id: '5', label: 'Schwert' },
  { id: '6', label: 'Axt' },
  { id: '7', label: 'Streitkolben' },
  { id: '8', label: 'Dreizack' },
  { id: '9', label: 'Bogen' },
  { id: '10', label: 'Armbrust' },
  { id: '11', label: 'Schild' },
  { id: '12', label: 'Elytra' },
  { id: '13', label: 'Schildkrötenpanzer' },
  { id: '14', label: 'Golden Horse Armor' },
  { id: '15', label: 'Spitzhacke' },
  { id: '16', label: 'Hacke' },
  { id: '17', label: 'Schaufel' },
  { id: '18', label: 'Angel' }
];

const slugify = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
      ? String(value)
      : '';
  const trimmed = stringValue.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const replaced = lower
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  const withoutDiacritics = replaced.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return withoutDiacritics.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

const definitions = RAW_ITEM_TYPES.map(({ id, label }) => {
  const key = slugify(label);
  return { id, key, label };
});

const aliasToKey = new Map();
const keyToLabel = new Map();

for (const type of definitions) {
  keyToLabel.set(type.key, type.label);

  aliasToKey.set(type.key, type.key);
  aliasToKey.set(type.id, type.key);

  const labelSlug = slugify(type.label);
  if (labelSlug) {
    aliasToKey.set(labelSlug, type.key);
  }

  const compactLabelSlug = slugify(type.label.replace(/\s+/g, ''));
  if (compactLabelSlug) {
    aliasToKey.set(compactLabelSlug, type.key);
  }

  if (/[öÖ]/.test(type.label)) {
    const simpleVariant = slugify(type.label.replace(/ö/gi, 'o'));
    if (simpleVariant) {
      aliasToKey.set(simpleVariant, type.key);
    }
  }
}

export const itemTypeOptions = definitions.map(({ key, label }) => ({
  value: key,
  label
}));

export const getItemTypeKey = (value) => {
  if (value === null || value === undefined) return '';
  const slug = slugify(value);
  if (!slug) return '';
  return aliasToKey.get(slug) ?? slug;
};

export const getItemTypeLabel = (value) => {
  const key = getItemTypeKey(value);
  if (!key) return null;
  return keyToLabel.get(key) ?? null;
};
