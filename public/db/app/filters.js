import { state } from './state.js';
import { getItemTypeKey } from './item-types.js';
import { getRarityKey } from './utils.js';

export const filtersApplied = () =>
  Boolean(getItemTypeKey(state.filters.type) || getRarityKey(state.filters.rarity));

export const applyFilters = (items) => {
  const typeFilter = getItemTypeKey(state.filters.type);
  const rarityFilter = getRarityKey(state.filters.rarity);

  if (!typeFilter && !rarityFilter) return items;

  return items.filter((item) => {
    const itemType = getItemTypeKey(item?.type);
    const itemRarity = getRarityKey(item?.rarity);
    const matchesType = !typeFilter || itemType === typeFilter;
    const matchesRarity = !rarityFilter || itemRarity === rarityFilter;
    return matchesType && matchesRarity;
  });
};
