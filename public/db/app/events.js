import { elements } from './elements.js';
import { loadItems, triggerSearch } from './api.js';
import { closeDetail, handleDetailKeydown } from './detail.js';
import { state } from './state.js';
import { debounce } from './utils.js';
import { render, updateStatusMessage } from './render.js';
import { closeAddItemModal, openAddItemModal, submitAddItemForm } from './create-item.js';
import { signInWithDiscord, signOut } from './auth.js';

export const initializeEvents = () => {
  if (elements.searchForm) {
    elements.searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
    });
  }

  const debouncedSearch = debounce(() => {
    state.mode = 'search';
    triggerSearch(true);
  }, 350);

  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (event) => {
      const value = event.target.value;
      state.searchQuery = value;
      if (value.trim()) {
        state.mode = 'search';
        debouncedSearch();
      } else {
        debouncedSearch.cancel();
        state.mode = 'list';
        state.lastSearchToken += 1;
        state.searchResults = [];
        state.searchHasMore = false;
        state.searchPage = 0;
        state.error = '';
        render();
        if (state.items.length === 0 && !state.loading) {
          loadItems({ reset: true });
        }
      }
      updateStatusMessage();
    });
  }

  if (elements.typeFilter) {
    elements.typeFilter.addEventListener('change', (event) => {
      state.filters.type = event.target.value || '';
      render();
    });
  }

  if (elements.rarityFilter) {
    elements.rarityFilter.addEventListener('change', (event) => {
      state.filters.rarity = event.target.value || '';
      render();
    });
  }

  if (elements.loadMoreButton) {
    elements.loadMoreButton.addEventListener('click', () => {
      if (state.loading) return;
      if (state.mode === 'search') {
        triggerSearch(false);
      } else {
        loadItems({ reset: false });
      }
    });
  }

  if (elements.addItemButton) {
    elements.addItemButton.addEventListener('click', () => {
      openAddItemModal();
    });
  }

  if (elements.addItemForm) {
    elements.addItemForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitAddItemForm();
    });
  }

  if (elements.addItemModal) {
    elements.addItemModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.matches('[data-close-add-item]') ||
        target.closest('[data-close-add-item]')
      ) {
        closeAddItemModal();
      }
    });

    elements.addItemModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAddItemModal();
      }
    });
  }

  const view = elements.detailView;
  if (view) {
    view.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches('[data-close-detail]') || target.closest('[data-close-detail]')) {
        closeDetail();
      }
    });
    view.addEventListener('keydown', handleDetailKeydown);
  }

  if (elements.authLoginButton) {
    elements.authLoginButton.addEventListener('click', async () => {
      try {
        await signInWithDiscord();
      } catch (error) {
        console.error('Discord-Anmeldung fehlgeschlagen', error);
      }
    });
  }

  if (elements.authLogoutButton) {
    elements.authLogoutButton.addEventListener('click', async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Abmeldung fehlgeschlagen', error);
      }
    });
  }
};
