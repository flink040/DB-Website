import { state } from './state.js';
import { getItemTypeKey } from './item-types.js';
import { normalizeFilterValue } from './utils.js';

export const filtersApplied = () =>
  Boolean(getItemTypeKey(state.filters.type) || normalizeFilterValue(state.filters.rarity));

export const applyFilters = (items) => {
  const typeFilter = getItemTypeKey(state.filters.type);
  const rarityFilter = normalizeFilterValue(state.filters.rarity);

  if (!typeFilter && !rarityFilter) return items;

  return items.filter((item) => {
    const itemType = getItemTypeKey(item?.type);
    const itemRarity = normalizeFilterValue(item?.rarity);
    const matchesType = !typeFilter || itemType === typeFilter;
    const matchesRarity = !rarityFilter || itemRarity === rarityFilter;
    return matchesType && matchesRarity;
  });
};
