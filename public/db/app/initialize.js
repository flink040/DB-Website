import { loadItems } from './api.js';
import { initializeEvents } from './events.js';
import { render } from './render.js';

export const initializeApp = () => {
  initializeEvents();
  render();
  loadItems({ reset: true });
};
