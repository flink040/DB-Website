import { PAGE_SIZE } from './constants.js';
import { render, setLoading } from './render.js';
import { state, addRecentSearch } from './state.js';

const createResponseError = async (response) => {
  let serverMessage = '';
  try {
    const data = await response.json();
    const message = typeof data?.error === 'string' ? data.error.trim() : '';
    if (message) {
      serverMessage = message;
    }
  } catch {
    // ignore JSON parse errors
  }

  const error = new Error(serverMessage || `HTTP ${response.status}`);
  error.status = response.status;
  if (serverMessage) {
    error.serverMessage = serverMessage;
  }
  return error;
};

const getServerMessage = (error) => {
  const message = typeof error?.serverMessage === 'string' ? error.serverMessage.trim() : '';
  return message || '';
};

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
      throw await createResponseError(response);
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
      const fallbackMessage = 'Items konnten nicht geladen werden.';
      const serverMessage = getServerMessage(error);
      const displayMessage = serverMessage || fallbackMessage;
      state.error = displayMessage;
      const logMessage = serverMessage || error?.message || fallbackMessage;
      console.error('Failed to load items:', logMessage, error);
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
      throw await createResponseError(response);
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
      const fallbackMessage = 'Suche fehlgeschlagen.';
      const serverMessage = getServerMessage(error);
      const displayMessage = serverMessage || fallbackMessage;
      state.error = displayMessage;
      const logMessage = serverMessage || error?.message || fallbackMessage;
      console.error('Failed to search items:', logMessage, error);
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
  if (reset) {
    addRecentSearch(query);
  }
  const nextPage = reset ? 1 : state.searchPage + 1;
  searchItems({ page: nextPage, reset });
};
