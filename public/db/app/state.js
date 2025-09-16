export const state = {
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
    material: '',
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
