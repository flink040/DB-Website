import { state } from './state.js';
import { getItemTypeKey } from './item-types.js';
import { getRarityKey, getStarLevel } from './utils.js';

export const filtersApplied = () => {
  const hasType = Boolean(getItemTypeKey(state.filters.type));
  const hasRarity = Boolean(getRarityKey(state.filters.rarity));
  const hasStars = state.filters.stars !== '' && state.filters.stars !== null && state.filters.stars !== undefined;
  return hasType || hasRarity || hasStars;
};

export const applyFilters = (items) => {
  const typeFilter = getItemTypeKey(state.filters.type);
  const rarityFilter = getRarityKey(state.filters.rarity);
  const rawStarFilter = state.filters.stars;
  const hasStarFilter = rawStarFilter !== '' && rawStarFilter !== null && rawStarFilter !== undefined;
  const starFilterValue = hasStarFilter ? Number(rawStarFilter) : NaN;
  const starFilterValid = hasStarFilter && Number.isFinite(starFilterValue);

  if (!typeFilter && !rarityFilter && !starFilterValid) return items;

  return items.filter((item) => {
    const itemType = getItemTypeKey(item?.type);
    const itemRarity = getRarityKey(item?.rarity);
    const matchesType = !typeFilter || itemType === typeFilter;
    const matchesRarity = !rarityFilter || itemRarity === rarityFilter;
    const matchesStars = !starFilterValid || getStarLevel(item) === starFilterValue;
    return matchesType && matchesRarity && matchesStars;
  });
};
