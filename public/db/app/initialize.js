import { loadItems } from './api.js';
import { initializeEvents } from './events.js';
import { render } from './render.js';
import { initializeAuth } from './auth.js';

export const initializeApp = () => {
  void initializeAuth();
  initializeEvents();
  render();
  loadItems({ reset: true });
};
