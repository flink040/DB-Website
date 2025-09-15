import { state } from './state.js';
import { normalizeFilterValue } from './utils.js';

export const filtersApplied = () => Boolean(state.filters.type || state.filters.rarity);

export const applyFilters = (items) => {
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
