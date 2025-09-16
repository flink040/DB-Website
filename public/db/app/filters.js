import { MATERIAL_SYNONYMS } from './constants.js';
import { state } from './state.js';
import { normalizeFilterValue } from './utils.js';

const addNormalizedValue = (collection, value) => {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => addNormalizedValue(collection, entry));
    return;
  }
  const normalized = normalizeFilterValue(typeof value === 'string' ? value : String(value));
  if (normalized) {
    collection.push(normalized);
  }
};

const getMaterialValues = (item) => {
  const values = [];
  addNormalizedValue(values, item?.material);
  addNormalizedValue(values, item?.materials);
  addNormalizedValue(values, item?.material_name);
  addNormalizedValue(values, item?.materialName);
  addNormalizedValue(values, item?.material_type);
  addNormalizedValue(values, item?.materialType);
  addNormalizedValue(values, item?.material_display);
  addNormalizedValue(values, item?.materialDisplay);

  [item?.material_id, item?.materialId, item?.materialID].forEach((candidate) => {
    addNormalizedValue(values, candidate);
  });

  return Array.from(new Set(values));
};

const getMaterialTargets = (value) => {
  if (!value) return [];
  const direct = MATERIAL_SYNONYMS[value];
  if (direct) {
    return direct;
  }
  const fallback = Object.values(MATERIAL_SYNONYMS).find((synonyms) => synonyms.includes(value));
  return fallback ?? [value];
};

export const filtersApplied = () => Boolean(state.filters.type || state.filters.material || state.filters.rarity);

export const applyFilters = (items) => {
  const typeFilter = normalizeFilterValue(state.filters.type);
  const materialFilter = normalizeFilterValue(state.filters.material);
  const rarityFilter = normalizeFilterValue(state.filters.rarity);

  if (!typeFilter && !materialFilter && !rarityFilter) return items;

  const materialTargets = getMaterialTargets(materialFilter);

  return items.filter((item) => {
    const itemType = normalizeFilterValue(item?.type);
    const itemMaterials = getMaterialValues(item);
    const itemRarity = normalizeFilterValue(item?.rarity);
    const matchesType = !typeFilter || itemType === typeFilter;
    const matchesMaterial =
      !materialFilter || itemMaterials.some((value) => materialTargets.includes(value));
    const matchesRarity = !rarityFilter || itemRarity === rarityFilter;
    return matchesType && matchesMaterial && matchesRarity;
  });
};
