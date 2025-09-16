const DEFAULT_MAX_VISIBLE_OPTIONS = 5;
const GAP_SIZE = 8;

const isFunctionSupported = typeof CSS !== 'undefined' && typeof CSS.escape === 'function';
const escapeSelector = (value) => (isFunctionSupported ? CSS.escape(value) : value);

class EnhancedSelect {
  constructor(select) {
    this.select = select;
    this.wrapper = null;
    this.button = null;
    this.valueNode = null;
    this.dropdown = null;
    this.options = [];
    this.highlightedIndex = -1;
    this.selectedIndex = Math.max(select.selectedIndex, 0);
    this.isOpen = false;

    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleWindowReposition = this.positionDropdown.bind(this);

    this.initialize();
  }

  initialize() {
    if (this.select.dataset.customSelect === 'initialized') {
      return;
    }

    this.select.dataset.customSelect = 'initialized';
    this.createStructure();
    this.populateOptions();
    this.syncFromSelect();

    this.select.addEventListener('change', () => this.syncFromSelect());
  }

  createStructure() {
    const parent = this.select.parentElement;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'custom-select';
    parent.insertBefore(this.wrapper, this.select);
    this.wrapper.appendChild(this.select);

    this.select.classList.add('custom-select__native');
    this.select.tabIndex = -1;
    this.select.setAttribute('aria-hidden', 'true');

    const triggerId = `${this.select.id || this.select.name || 'select'}__trigger`;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.id = triggerId;
    this.button.className = 'custom-select__trigger';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');
    if (this.select.required) {
      this.button.setAttribute('aria-required', 'true');
    }

    this.valueNode = document.createElement('span');
    this.valueNode.className = 'custom-select__value';
    this.valueNode.textContent = '';
    this.button.appendChild(this.valueNode);
    this.wrapper.appendChild(this.button);

    this.dropdown = document.createElement('ul');
    this.dropdown.id = `${triggerId}__listbox`;
    this.dropdown.className = 'custom-select__dropdown';
    this.dropdown.setAttribute('role', 'listbox');
    this.dropdown.setAttribute('tabindex', '-1');
    this.dropdown.setAttribute('aria-labelledby', triggerId);
    this.dropdown.hidden = true;
    this.wrapper.appendChild(this.dropdown);

    this.button.setAttribute('aria-controls', this.dropdown.id);

    const associatedLabel = this.findAssociatedLabel();
    if (associatedLabel) {
      if (!associatedLabel.id) {
        associatedLabel.id = `${triggerId}__label`;
      }
      associatedLabel.setAttribute('for', triggerId);
      this.button.setAttribute('aria-labelledby', `${associatedLabel.id} ${triggerId}`);
      this.dropdown.setAttribute('aria-labelledby', associatedLabel.id);
    }

    this.button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
    });

    this.button.addEventListener('keydown', (event) => this.handleTriggerKeydown(event));
    this.dropdown.addEventListener('keydown', (event) => this.handleDropdownKeydown(event));
    this.dropdown.addEventListener('focusout', (event) => {
      if (!this.wrapper.contains(event.relatedTarget)) {
        this.close();
      }
    });
  }

  findAssociatedLabel() {
    if (!this.select.id) {
      return null;
    }
    const selector = `label[for='${escapeSelector(this.select.id)}']`;
    return document.querySelector(selector);
  }

  populateOptions() {
    this.options = [];
    Array.from(this.select.options).forEach((option, index) => {
      const optionElement = document.createElement('li');
      optionElement.className = 'custom-select__option';
      optionElement.dataset.value = option.value;
      optionElement.textContent = option.textContent;
      optionElement.setAttribute('role', 'option');
      optionElement.id = `${this.button.id}__option-${index}`;
      optionElement.tabIndex = -1;

      if (option.disabled) {
        optionElement.setAttribute('aria-disabled', 'true');
        optionElement.classList.add('custom-select__option--disabled');
      }

      if (option.selected) {
        optionElement.setAttribute('aria-selected', 'true');
        this.selectedIndex = index;
      }

      optionElement.addEventListener('click', (event) => {
        event.preventDefault();
        if (option.disabled) return;
        this.selectOption(index);
        this.close({ focusTrigger: true });
      });

      optionElement.addEventListener('mouseenter', () => {
        if (option.disabled) return;
        this.highlightOption(index, { focusOption: false, scrollIntoView: false });
      });

      this.dropdown.appendChild(optionElement);
      this.options.push(optionElement);
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close({ focusTrigger: true });
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.wrapper.classList.add('custom-select--open');
    this.button.setAttribute('aria-expanded', 'true');
    this.dropdown.hidden = false;
    this.positionDropdown();
    const indexToHighlight = this.selectedIndex >= 0 ? this.selectedIndex : 0;
    this.highlightOption(indexToHighlight);

    document.addEventListener('click', this.handleDocumentClick);
    window.addEventListener('resize', this.handleWindowReposition);
    window.addEventListener('scroll', this.handleWindowReposition, true);
  }

  close({ focusTrigger = false } = {}) {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.wrapper.classList.remove('custom-select--open', 'custom-select--above');
    this.button.setAttribute('aria-expanded', 'false');
    this.dropdown.hidden = true;
    this.dropdown.style.left = '';
    this.dropdown.style.top = '';
    this.dropdown.style.width = '';

    document.removeEventListener('click', this.handleDocumentClick);
    window.removeEventListener('resize', this.handleWindowReposition);
    window.removeEventListener('scroll', this.handleWindowReposition, true);

    if (focusTrigger) {
      this.button.focus();
    }
  }

  handleDocumentClick(event) {
    if (!this.wrapper.contains(event.target)) {
      this.close();
    }
  }

  positionDropdown() {
    if (!this.isOpen) return;

    const rect = this.button.getBoundingClientRect();
    const width = rect.width;
    const left = rect.left + window.scrollX;
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    let top = rect.bottom + window.scrollY + GAP_SIZE;

    this.dropdown.style.width = `${width}px`;
    this.dropdown.style.left = `${left}px`;
    this.dropdown.style.top = `${top}px`;

    const maxVisible = Math.max(DEFAULT_MAX_VISIBLE_OPTIONS, 2);
    const optionHeight = this.calculateOptionHeight();
    const maxHeight = optionHeight * maxVisible;
    this.dropdown.style.maxHeight = `${maxHeight}px`;

    const dropdownHeight = this.dropdown.offsetHeight;
    let openAbove = false;

    if (top + dropdownHeight > viewportBottom) {
      const potentialTop = rect.top + window.scrollY - dropdownHeight - GAP_SIZE;
      if (potentialTop >= viewportTop + GAP_SIZE) {
        top = potentialTop;
        openAbove = true;
      } else {
        const constrainedTop = viewportBottom - dropdownHeight - GAP_SIZE;
        top = Math.max(viewportTop + GAP_SIZE, constrainedTop);
      }
    }

    top = Math.max(viewportTop + GAP_SIZE, top);
    this.dropdown.style.top = `${top}px`;
    this.wrapper.classList.toggle('custom-select--above', openAbove);
  }

  calculateOptionHeight() {
    if (this.options.length === 0) {
      return 40;
    }
    const measured = this.options[0].getBoundingClientRect().height;
    return measured > 0 ? measured : 40;
  }

  highlightOption(index, { focusOption = true, scrollIntoView = true } = {}) {
    if (index < 0 || index >= this.options.length) {
      return;
    }
    if (this.options[index].classList.contains('custom-select__option--disabled')) {
      return;
    }

    this.highlightedIndex = index;
    this.dropdown.setAttribute('aria-activedescendant', this.options[index].id);

    this.options.forEach((optionElement, optionIndex) => {
      optionElement.classList.toggle('custom-select__option--highlighted', optionIndex === index);
    });

    if (focusOption) {
      this.options[index].focus();
    }
    if (scrollIntoView) {
      this.options[index].scrollIntoView({ block: 'nearest' });
    }
  }

  handleTriggerKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
      case 'Down':
        event.preventDefault();
        if (!this.isOpen) {
          this.open();
        }
        this.highlightOption(this.findNextEnabledIndex(this.highlightedIndex >= 0 ? this.highlightedIndex : this.selectedIndex, 1));
        break;
      case 'ArrowUp':
      case 'Up':
        event.preventDefault();
        if (!this.isOpen) {
          this.open();
        }
        this.highlightOption(this.findNextEnabledIndex(this.highlightedIndex >= 0 ? this.highlightedIndex : this.selectedIndex, -1));
        break;
      case 'Enter':
      case ' ': // Space
        event.preventDefault();
        if (this.isOpen) {
          if (this.highlightedIndex >= 0) {
            this.selectOption(this.highlightedIndex);
          }
          this.close({ focusTrigger: true });
        } else {
          this.open();
        }
        break;
      case 'Home':
        event.preventDefault();
        if (!this.isOpen) {
          this.open();
        }
        this.highlightOption(this.findNextEnabledIndex(-1, 1));
        break;
      case 'End':
        event.preventDefault();
        if (!this.isOpen) {
          this.open();
        }
        this.highlightOption(this.findNextEnabledIndex(this.options.length, -1));
        break;
      case 'Escape':
        if (this.isOpen) {
          event.preventDefault();
          this.close({ focusTrigger: true });
        }
        break;
      default:
        break;
    }
  }

  handleDropdownKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
      case 'Down':
        event.preventDefault();
        this.highlightOption(this.findNextEnabledIndex(this.highlightedIndex, 1));
        break;
      case 'ArrowUp':
      case 'Up':
        event.preventDefault();
        this.highlightOption(this.findNextEnabledIndex(this.highlightedIndex, -1));
        break;
      case 'Home':
        event.preventDefault();
        this.highlightOption(this.findNextEnabledIndex(-1, 1));
        break;
      case 'End':
        event.preventDefault();
        this.highlightOption(this.findNextEnabledIndex(this.options.length, -1));
        break;
      case 'Enter':
      case ' ': // Space
        event.preventDefault();
        if (this.highlightedIndex >= 0) {
          this.selectOption(this.highlightedIndex);
          this.close({ focusTrigger: true });
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.close({ focusTrigger: true });
        break;
      case 'Tab':
        this.close();
        break;
      default:
        break;
    }
  }

  findNextEnabledIndex(startIndex, direction) {
    if (this.options.length === 0) {
      return -1;
    }

    const length = this.options.length;
    let index = startIndex;

    do {
      index = index + direction;
      if (index < 0) {
        index = length - 1;
      } else if (index >= length) {
        index = 0;
      }

      const optionElement = this.options[index];
      if (!optionElement.classList.contains('custom-select__option--disabled')) {
        return index;
      }
    } while (index !== startIndex);

    return Math.max(Math.min(startIndex, length - 1), 0);
  }

  selectOption(index) {
    if (index < 0 || index >= this.select.options.length) {
      return;
    }
    const option = this.select.options[index];
    if (option.disabled) return;

    this.select.selectedIndex = index;
    this.selectedIndex = index;

    this.select.dispatchEvent(new Event('input', { bubbles: true }));
    this.select.dispatchEvent(new Event('change', { bubbles: true }));

    this.syncFromSelect();
  }

  syncFromSelect() {
    const selected = this.select.selectedIndex >= 0 ? this.select.options[this.select.selectedIndex] : null;
    this.selectedIndex = this.select.selectedIndex;
    this.valueNode.textContent = selected ? selected.textContent : '';

    this.options.forEach((optionElement, index) => {
      if (index === this.selectedIndex) {
        optionElement.setAttribute('aria-selected', 'true');
      } else {
        optionElement.removeAttribute('aria-selected');
      }
    });
  }
}

export const enhanceSelects = () => {
  const selects = document.querySelectorAll('select[data-enhance-select]');
  selects.forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    new EnhancedSelect(select);
  });
};
