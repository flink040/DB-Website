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
    rarity: '',
    stars: ''
  },
  loading: false,
  error: '',
  lastListToken: 0,
  lastSearchToken: 0,
  detailToken: 0,
  activeDetailId: null,
  lastFocusedElement: null,
  recentSearches: [],
  auth: {
    status: 'idle',
    profile: null,
    error: '',
    session: null,
    menuOpen: false
  }
};

const RECENT_SEARCH_LIMIT = 6;

export const addRecentSearch = (value) => {
  const query = typeof value === 'string' ? value.trim() : '';
  if (!query) return;
  const existing = Array.isArray(state.recentSearches) ? [...state.recentSearches] : [];
  const normalizedQuery = query.toLowerCase();
  const filtered = existing.filter((entry) => typeof entry === 'string' && entry.toLowerCase() !== normalizedQuery);
  filtered.unshift(query);
  state.recentSearches = filtered.slice(0, RECENT_SEARCH_LIMIT);
};
