import { elements } from './elements.js';
import { loadItems } from './api.js';
import { getAccessToken } from './auth.js';
import { state } from './state.js';

let lastFocusedElement = null;
let isSubmitting = false;
let autoCloseHandle = null;

const setFormStatus = (message, status) => {
  const statusElement = elements.addItemStatus;
  if (!statusElement) return;
  statusElement.textContent = message ?? '';
  if (status) {
    statusElement.dataset.status = status;
  } else {
    delete statusElement.dataset.status;
  }
};

const setFormBusy = (busy) => {
  const form = elements.addItemForm;
  if (!form) return;
  form.setAttribute('aria-busy', busy ? 'true' : 'false');
  const controls = form.querySelectorAll('input, select, textarea, button');
  controls.forEach((control) => {
    control.disabled = busy;
  });

  if (elements.addItemSubmitButton) {
    elements.addItemSubmitButton.disabled = busy;
  }
  if (elements.addItemCancelButton) {
    elements.addItemCancelButton.disabled = busy;
  }
  if (elements.addItemCloseButton) {
    elements.addItemCloseButton.disabled = busy;
  }
};

const collectFormData = () => {
  const form = elements.addItemForm;
  if (!form) {
    throw new Error('Formular ist nicht verfügbar.');
  }

  const data = new FormData(form);
  const name = typeof data.get('name') === 'string' ? data.get('name').trim() : '';
  const type = typeof data.get('type') === 'string' ? data.get('type').trim() : '';
  const rarity = typeof data.get('rarity') === 'string' ? data.get('rarity').trim() : '';

  if (!name) {
    throw new Error('Bitte einen Namen angeben.');
  }
  if (!type) {
    throw new Error('Bitte einen Item-Typ auswählen.');
  }
  if (!rarity) {
    throw new Error('Bitte eine Seltenheit auswählen.');
  }

  const payload = {
    name,
    type,
    rarity,
    released_at: new Date().toISOString()
  };

  const starsValue = typeof data.get('stars') === 'string' ? data.get('stars').trim() : '';
  if (starsValue) {
    const stars = Number(starsValue);
    if (!Number.isFinite(stars) || stars < 0 || stars > 3) {
      throw new Error('Bitte eine gültige Sternanzahl zwischen 0 und 3 angeben.');
    }
    payload.stars = stars;
  }

  const imageUrl = typeof data.get('image_url') === 'string' ? data.get('image_url').trim() : '';
  if (imageUrl) {
    payload.image_url = imageUrl;
  }

  const description = typeof data.get('description') === 'string' ? data.get('description').trim() : '';
  if (description) {
    payload.description = description;
  }

  return payload;
};

export const openAddItemModal = () => {
  const modal = elements.addItemModal;
  if (!modal) return;
  window.clearTimeout(autoCloseHandle);
  autoCloseHandle = null;
  isSubmitting = false;

  const form = elements.addItemForm;
  if (form) {
    form.reset();
  }
  setFormBusy(false);
  setFormStatus('');

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.scrollTop = 0;
  document.body.dataset.addItemOpen = 'true';
  lastFocusedElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  window.requestAnimationFrame(() => {
    if (elements.addItemName && typeof elements.addItemName.focus === 'function') {
      elements.addItemName.focus();
    } else if (typeof modal.focus === 'function') {
      modal.focus();
    }
  });
};

export const closeAddItemModal = () => {
  const modal = elements.addItemModal;
  if (!modal) return;
  window.clearTimeout(autoCloseHandle);
  autoCloseHandle = null;
  if (isSubmitting) {
    return;
  }

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  delete document.body.dataset.addItemOpen;

  const form = elements.addItemForm;
  if (form) {
    form.reset();
    form.setAttribute('aria-busy', 'false');
  }
  setFormBusy(false);
  setFormStatus('');

  const focusTarget = lastFocusedElement;
  lastFocusedElement = null;
  if (focusTarget && typeof focusTarget.focus === 'function') {
    focusTarget.focus();
  }
};

export const submitAddItemForm = async () => {
  if (isSubmitting) return;
  const form = elements.addItemForm;
  if (!form) return;

  if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
    return;
  }

  if (!state.auth?.profile) {
    setFormStatus('Bitte melde dich mit Discord an, bevor du Items hinzufügst.', 'error');
    return;
  }

  let payload;
  try {
    payload = collectFormData();
  } catch (validationError) {
    const message =
      validationError instanceof Error && validationError.message
        ? validationError.message
        : 'Bitte alle Pflichtfelder korrekt ausfüllen.';
    setFormStatus(message, 'error');
    return;
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    setFormStatus('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.', 'error');
    return;
  }

  isSubmitting = true;
  setFormBusy(true);
  setFormStatus('Item wird erstellt…', 'pending');

  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Bitte melde dich an, um neue Items hinzuzufügen.');
      }
      let errorMessage = `Item konnte nicht erstellt werden (HTTP ${response.status}).`;
      try {
        const errorBody = await response.json();
        const apiMessage =
          errorBody?.error ||
          errorBody?.message ||
          errorBody?.data?.error ||
          errorBody?.data?.message;
        if (typeof apiMessage === 'string' && apiMessage.trim()) {
          errorMessage = apiMessage.trim();
        }
      } catch (parseError) {
        console.warn('Antwort konnte nicht analysiert werden', parseError);
      }
      throw new Error(errorMessage);
    }

    setFormStatus('Item erfolgreich erstellt.', 'success');
    void loadItems({ reset: true });
    autoCloseHandle = window.setTimeout(() => {
      closeAddItemModal();
    }, 600);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Item konnte nicht erstellt werden.';
    setFormStatus(message, 'error');
  } finally {
    setFormBusy(false);
    isSubmitting = false;
  }
};
