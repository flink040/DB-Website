import { PAGE_SIZE } from './constants.js';
import { render, setLoading } from './render.js';
import { state } from './state.js';

export const loadItems = async ({ reset = false } = {}) => {
  const token = ++state.lastListToken;

  if (reset) {
    state.items = [];
    state.nextCursor = null;
    state.hasMore = false;
    render();
  }

  setLoading(true);

  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  if (!reset && state.nextCursor) {
    params.set('cursor', state.nextCursor);
  }

  try {
    const response = await fetch(`/api/items?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (token !== state.lastListToken) return;

    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.items = reset ? items : [...state.items, ...items];
    state.nextCursor = payload?.nextCursor ?? null;
    state.hasMore = Boolean(payload?.nextCursor);
    state.error = '';
  } catch (error) {
    if (token === state.lastListToken) {
      if (reset) {
        state.items = [];
      }
      state.hasMore = false;
      state.error = 'Items konnten nicht geladen werden.';
      console.error(error);
    }
  } finally {
    if (token === state.lastListToken) {
      setLoading(false);
      render();
    }
  }
};

export const searchItems = async ({ page, reset }) => {
  const query = state.searchQuery.trim();
  if (!query) return;
  const token = ++state.lastSearchToken;

  if (reset) {
    state.searchResults = [];
    state.searchHasMore = false;
    render();
  }

  setLoading(true);

  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', String(PAGE_SIZE * page));

  try {
    const response = await fetch(`/api/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (token !== state.lastSearchToken) return;

    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.searchResults = items;
    const count = Number(payload?.count ?? items.length);
    state.searchHasMore = Number.isFinite(count)
      ? count >= PAGE_SIZE * page
      : items.length >= PAGE_SIZE * page;
    state.searchPage = page;
    state.error = '';
  } catch (error) {
    if (token === state.lastSearchToken) {
      if (reset) {
        state.searchResults = [];
        state.searchPage = 0;
      }
      state.searchHasMore = false;
      state.error = 'Suche fehlgeschlagen.';
      console.error(error);
    }
  } finally {
    if (token === state.lastSearchToken) {
      setLoading(false);
      render();
    }
  }
};

export const triggerSearch = (reset) => {
  const query = state.searchQuery.trim();
  if (!query) return;
  const nextPage = reset ? 1 : state.searchPage + 1;
  searchItems({ page: nextPage, reset });
};
