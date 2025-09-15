import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), delay);
  };
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const env = window.ENV || {};
let supabaseClient = null;

if (env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY) {
  supabaseClient = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);
} else {
  console.info(
    "Supabase ENV Variablen fehlen. TODO: PUBLIC_SUPABASE_URL und PUBLIC_SUPABASE_ANON_KEY setzen."
  );
}

const state = {
  user: null,
  sidebarCollapsed: false,
  filters: {
    item_type: "",
    rarity: ""
  },
  searchQuery: "",
  resultsCount: null,
  searchLoading: false,
  enchantments: [],
  isFilterOpen: false,
  isProfileOpen: false,
  modalOpen: false,
  missingBackendNotified: false
};

const iconCache = new Map();

const applyIconMarkup = (el, data) => {
  if (!data) return;
  ["viewBox", "width", "height"].forEach((attr) => {
    if (!data.attrs?.[attr]) {
      el.removeAttribute(attr);
    }
  });
  el.innerHTML = data.markup;
  Object.entries(data.attrs || {}).forEach(([key, value]) => {
    if (value) {
      el.setAttribute(key, value);
    }
  });
};
let filterOutsideHandler = null;
let dropdownOutsideHandler = null;
let profileOutsideHandler = null;
let modalKeyHandler = null;
let profileKeyHandler = null;
let currentSearchToken = 0;

const elements = {
  sidebar: qs(".sidebar"),
  sidebarToggle: qs(".sidebar__toggle"),
  avatarButton: qs("#avatarButton"),
  avatarDropdown: qs("#avatarDropdown"),
  dropdownContent: qs("#avatarDropdown .dropdown__content"),
  searchInput: qs("#searchInput"),
  searchForm: qs("#searchForm"),
  filterButton: qs("#filterButton"),
  filterPopover: qs("#filterPopover"),
  filterForm: qs("#filterForm"),
  resetFilters: qs("#resetFilters"),
  filterClose: qs("[data-close-filter]"),
  resultInfo: qs("#resultInfo"),
  addItemButton: qs("#addItemButton"),
  itemModal: qs("#itemModal"),
  itemForm: qs("#itemForm"),
  modalCloseTriggers: qsa("[data-modal-close]"),
  enchantmentsList: qs("#enchantmentsList"),
  enchantmentHint: qs("#enchantmentHint"),
  modalSubmit: qs("#modalSubmit"),
  toastRegion: qs("#toastRegion"),
  profilePanel: qs("#profilePanel"),
  profileEmail: qs("#profileEmail"),
  profileId: qs("#profileId"),
  profileClose: qs("[data-close-profile]")
};

const setResultInfo = () => {
  if (!elements.resultInfo) return;
  if (state.searchLoading) {
    elements.resultInfo.textContent = "Suche läuft…";
    return;
  }

  if (state.resultsCount === null) {
    elements.resultInfo.textContent = "Ergebnisse erscheinen hier…";
    return;
  }

  const count = state.resultsCount;
  if (typeof count === "number") {
    elements.resultInfo.textContent = count === 0 ? "Keine Ergebnisse gefunden" : `${count} Ergebnisse gefunden`;
  }
};

const toast = (message, options = {}) => {
  const region = elements.toastRegion;
  if (!region) return;
  const { duration = 4500 } = options;
  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "alert");

  const msg = document.createElement("div");
  msg.className = "toast__message";
  msg.textContent = message;
  toastEl.appendChild(msg);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast__close";
  close.setAttribute("aria-label", "Toast schließen");
  close.textContent = "×";
  close.addEventListener("click", () => removeToast(toastEl));
  toastEl.appendChild(close);

  region.appendChild(toastEl);
  requestAnimationFrame(() => {
    toastEl.dataset.show = "true";
  });

  let hideTimeout = setTimeout(() => removeToast(toastEl), duration);
  const pause = () => {
    if (!hideTimeout) return;
    clearTimeout(hideTimeout);
    hideTimeout = null;
  };
  const resume = () => {
    if (hideTimeout) return;
    hideTimeout = setTimeout(() => removeToast(toastEl), 1600);
  };

  toastEl.addEventListener("mouseenter", pause);
  toastEl.addEventListener("mouseleave", resume);
};

const removeToast = (toastEl) => {
  if (!toastEl) return;
  toastEl.dataset.show = "false";
  setTimeout(() => toastEl.remove(), 160);
};

const inlineExternalIcons = async () => {
  const iconElements = qsa(".icon[data-icon]");
  await Promise.all(
    iconElements.map(async (el) => {
      const name = el.dataset.icon;
      if (!name) return;
      el.innerHTML = `<use href="#icon-${name}"></use>`;
      const cached = iconCache.get(name);
      if (cached) {
        applyIconMarkup(el, cached);
        return;
      }

      try {
        const response = await fetch(`../assets/icons/${name}.svg`, { cache: "force-cache" });
        if (!response.ok) throw new Error("Icon nicht gefunden");
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svgNode = doc.querySelector("svg");
        const iconData = svgNode
          ? {
              markup: svgNode.innerHTML,
              attrs: ["viewBox", "width", "height"].reduce((acc, attr) => {
                const value = svgNode.getAttribute(attr);
                if (value) acc[attr] = value;
                return acc;
              }, {})
            }
          : { markup: text, attrs: {} };
        iconCache.set(name, iconData);
        applyIconMarkup(el, iconData);
      } catch (error) {
        // fallback already injected
        const fallback = {
          markup: `<use href="#icon-${name}"></use>`,
          attrs: {}
        };
        iconCache.set(name, fallback);
        applyIconMarkup(el, fallback);
      }
    })
  );
};

const initSidebarState = () => {
  const stored = localStorage.getItem("sidebarCollapsed");
  const prefersCollapsed = window.matchMedia("(max-width: 1024px)").matches;
  state.sidebarCollapsed = stored !== null ? stored === "true" : prefersCollapsed;
  applySidebarState(true);
};

const applySidebarState = (isInitial = false) => {
  if (!elements.sidebar || !elements.sidebarToggle) return;
  elements.sidebar.dataset.collapsed = String(state.sidebarCollapsed);
  elements.sidebarToggle.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
  elements.sidebarToggle.textContent = state.sidebarCollapsed ? "☰" : "×";
  if (!isInitial) {
    localStorage.setItem("sidebarCollapsed", String(state.sidebarCollapsed));
  }
};

const toggleSidebar = () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  applySidebarState();
};

const updateFilterButtonState = () => {
  if (!elements.filterButton) return;
  const hasFilter = Boolean(state.filters.item_type || state.filters.rarity);
  elements.filterButton.dataset.active = hasFilter ? "true" : "false";
};

const openFilterPopover = () => {
  if (!elements.filterPopover) return;
  if (!elements.filterButton) return;
  if (state.isFilterOpen) return;

  state.isFilterOpen = true;
  const popover = elements.filterPopover;
  if (elements.filterForm) {
    if (elements.filterForm.item_type) {
      elements.filterForm.item_type.value = state.filters.item_type;
    }
    if (elements.filterForm.rarity) {
      elements.filterForm.rarity.value = state.filters.rarity;
    }
  }
  popover.hidden = false;
  requestAnimationFrame(() => {
    const rect = elements.filterButton.getBoundingClientRect();
    const preferredTop = rect.bottom + 12;
    const preferredLeft = rect.right - popover.offsetWidth;
    const top = Math.min(
      preferredTop,
      window.innerHeight - popover.offsetHeight - 16
    );
    const left = Math.max(16, Math.min(preferredLeft, window.innerWidth - popover.offsetWidth - 16));
    popover.style.top = `${Math.max(16, top)}px`;
    popover.style.left = `${left}px`;
    popover.dataset.open = "true";
    const focusable = popover.querySelector(FOCUSABLE_SELECTOR);
    focusable?.focus();
  });

  elements.filterButton?.setAttribute("aria-expanded", "true");

  filterOutsideHandler = (event) => {
    if (
      !elements.filterPopover.contains(event.target) &&
      !elements.filterButton.contains(event.target)
    ) {
      closeFilterPopover();
    }
  };

  document.addEventListener("mousedown", filterOutsideHandler, true);
  document.addEventListener("keydown", handleFilterKeydown);
};

const handleFilterKeydown = (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeFilterPopover();
    elements.filterButton?.focus();
  }
};

const closeFilterPopover = () => {
  if (!elements.filterPopover) return;
  if (!state.isFilterOpen) return;
  state.isFilterOpen = false;
  elements.filterButton?.setAttribute("aria-expanded", "false");
  elements.filterPopover.dataset.open = "false";
  document.removeEventListener("mousedown", filterOutsideHandler, true);
  document.removeEventListener("keydown", handleFilterKeydown);
  filterOutsideHandler = null;
  setTimeout(() => {
    if (state.isFilterOpen) return;
    elements.filterPopover.hidden = true;
  }, 140);
};

const openAvatarDropdown = () => {
  if (!elements.avatarDropdown) return;
  if (elements.avatarDropdown.dataset.open === "true") return;
  elements.avatarDropdown.hidden = false;
  requestAnimationFrame(() => {
    elements.avatarDropdown.dataset.open = "true";
  });
  elements.avatarButton?.setAttribute("aria-expanded", "true");

  dropdownOutsideHandler = (event) => {
    if (
      !elements.avatarDropdown.contains(event.target) &&
      !elements.avatarButton.contains(event.target)
    ) {
      closeAvatarDropdown();
    }
  };

  document.addEventListener("mousedown", dropdownOutsideHandler, true);
  document.addEventListener("keydown", handleDropdownKeydown);
};

const closeAvatarDropdown = () => {
  if (!elements.avatarDropdown) return;
  elements.avatarDropdown.dataset.open = "false";
  elements.avatarButton?.setAttribute("aria-expanded", "false");
  document.removeEventListener("mousedown", dropdownOutsideHandler, true);
  document.removeEventListener("keydown", handleDropdownKeydown);
  dropdownOutsideHandler = null;
  setTimeout(() => {
    if (elements.avatarDropdown.dataset.open === "true") return;
    elements.avatarDropdown.hidden = true;
  }, 140);
};

const handleDropdownKeydown = (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeAvatarDropdown();
    elements.avatarButton?.focus();
  }
};

const openProfilePanel = () => {
  if (!elements.profilePanel) return;
  if (state.isProfileOpen) return;
  state.isProfileOpen = true;
  elements.profilePanel.hidden = false;
  requestAnimationFrame(() => {
    elements.profilePanel.dataset.open = "true";
    elements.profilePanel.querySelector("button")?.focus();
  });

  profileOutsideHandler = (event) => {
    if (
      !elements.profilePanel.contains(event.target) &&
      !elements.avatarDropdown.contains(event.target)
    ) {
      closeProfilePanel();
    }
  };

  profileKeyHandler = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeProfilePanel();
      elements.avatarButton?.focus();
    }
  };

  document.addEventListener("mousedown", profileOutsideHandler, true);
  document.addEventListener("keydown", profileKeyHandler);
};

const closeProfilePanel = () => {
  if (!elements.profilePanel || !state.isProfileOpen) return;
  state.isProfileOpen = false;
  elements.profilePanel.dataset.open = "false";
  document.removeEventListener("mousedown", profileOutsideHandler, true);
  document.removeEventListener("keydown", profileKeyHandler);
  profileOutsideHandler = null;
  profileKeyHandler = null;
  setTimeout(() => {
    if (state.isProfileOpen) return;
    elements.profilePanel.hidden = true;
  }, 140);
};

const openItemModal = async () => {
  if (!state.user) {
    openAvatarDropdown();
    toast("Bitte per Discord anmelden", { duration: 5000 });
    return;
  }

  if (!supabaseClient) {
    toast("Supabase Konfiguration fehlt", { duration: 5000 });
    return;
  }

  await ensureEnchantments();
  renderEnchantments();

  if (!elements.itemModal) return;
  if (state.modalOpen) return;
  state.modalOpen = true;
  elements.itemModal.hidden = false;
  requestAnimationFrame(() => {
    elements.itemModal.dataset.open = "true";
    trapFocus(elements.itemModal);
    const firstFocusable = getFocusableElements(elements.itemModal)[0];
    firstFocusable?.focus();
  });
};

const closeItemModal = () => {
  if (!elements.itemModal || !state.modalOpen) return;
  state.modalOpen = false;
  elements.itemModal.dataset.open = "false";
  releaseFocus();
  elements.itemForm?.reset();
  setTimeout(() => {
    if (state.modalOpen) return;
    elements.itemModal.hidden = true;
  }, 140);
};

const getFocusableElements = (container) => {
  return qsa(FOCUSABLE_SELECTOR, container).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (el.offsetParent === null && style.position !== "fixed") return false;
    return true;
  });
};

let focusTrap = null;

const trapFocus = (container) => {
  releaseFocus();
  const focusable = getFocusableElements(container);
  const previouslyFocused = document.activeElement;
  focusTrap = {
    container,
    focusable,
    previouslyFocused
  };

  modalKeyHandler = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeItemModal();
      return;
    }

    if (event.key === "Tab" && focusTrap?.focusable.length) {
      const { focusable } = focusTrap;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener("keydown", modalKeyHandler);
};

const releaseFocus = () => {
  if (!focusTrap) return;
  document.removeEventListener("keydown", modalKeyHandler);
  focusTrap.previouslyFocused?.focus?.();
  focusTrap = null;
  modalKeyHandler = null;
};

const ensureEnchantments = async () => {
  if (!elements.enchantmentHint) return;
  if (!supabaseClient) {
    elements.enchantmentHint.textContent = "Keine Verbindung zur Datenbank";
    state.enchantments = [];
    return;
  }

  if (state.enchantments.length) {
    elements.enchantmentHint.textContent =
      "Wähle Verzauberungen aus und gib ein Level an.";
    return;
  }

  elements.enchantmentHint.textContent = "Lade Verzauberungen…";

  try {
    const { data, error } = await supabaseClient
      .from("enchantments")
      .select("id, name, max_level")
      .order("name", { ascending: true });
    if (error) throw error;
    state.enchantments = data ?? [];
    elements.enchantmentHint.textContent = state.enchantments.length
      ? "Wähle Verzauberungen aus und gib ein Level an."
      : "Keine Verzauberungen vorhanden.";
  } catch (error) {
    console.error(error);
    toast("Verzauberungen konnten nicht geladen werden", { duration: 5000 });
    elements.enchantmentHint.textContent = "Fehler beim Laden";
  }
};

const renderEnchantments = () => {
  if (!elements.enchantmentsList) return;
  elements.enchantmentsList.innerHTML = "";
  if (!state.enchantments.length) return;

  state.enchantments.forEach((ench) => {
    const option = document.createElement("div");
    option.className = "enchantment-option";
    const checkboxId = `enchantment-${ench.id}`;
    option.innerHTML = `
      <label for="${checkboxId}">
        <input type="checkbox" id="${checkboxId}" name="enchantments" value="${ench.id}" />
        <span>${ench.name}</span>
        <span class="enchantment-option__max">max ${ench.max_level ?? 1}</span>
      </label>
      <div class="enchantment-option__level" data-level-container hidden>
        <label>
          Level
          <input type="number" name="enchantment-level-${ench.id}" min="1" max="${ench.max_level ?? 1}" value="1" />
        </label>
      </div>
    `;

    const checkbox = option.querySelector("input[type='checkbox']");
    const levelContainer = option.querySelector("[data-level-container]");
    const levelInput = option.querySelector("input[type='number']");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        option.classList.add("is-active");
        levelContainer.hidden = false;
        levelInput.focus();
      } else {
        option.classList.remove("is-active");
        levelContainer.hidden = true;
      }
    });

    elements.enchantmentsList.appendChild(option);
  });
  resetEnchantmentLevels();
};

function resetEnchantmentLevels() {
  if (!elements.enchantmentsList) return;
  qsa(".enchantment-option", elements.enchantmentsList).forEach((option) => {
    option.classList.remove("is-active");
    const levelContainer = option.querySelector("[data-level-container]");
    if (levelContainer) {
      levelContainer.hidden = true;
    }
  });
}

const performSearch = async () => {
  const token = ++currentSearchToken;
  state.searchLoading = true;
  setResultInfo();

  const query = state.searchQuery.trim();
  if (!query && !state.filters.item_type && !state.filters.rarity) {
    if (token === currentSearchToken) {
      state.searchLoading = false;
      state.resultsCount = null;
      setResultInfo();
    }
    return;
  }

  try {
    const count = await executeSearch({ query, filters: state.filters });
    if (token === currentSearchToken) {
      state.resultsCount = typeof count === "number" ? count : null;
    }
  } catch (error) {
    console.error(error);
    if (token === currentSearchToken) {
      toast("Suche fehlgeschlagen", { duration: 5000 });
      state.resultsCount = null;
    }
  } finally {
    if (token === currentSearchToken) {
      state.searchLoading = false;
      setResultInfo();
    }
  }
};

const executeSearch = async ({ query, filters }) => {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filters.item_type) params.set("type", filters.item_type);
  if (filters.rarity) params.set("rarity", filters.rarity);

  if (env.API_BASE) {
    const base = env.API_BASE.replace(/\/$/, "");
    const url = `${base}/search?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "include"
    });
    if (!response.ok) {
      throw new Error("API-Antwort fehlgeschlagen");
    }
    const payload = await response.json();
    if (typeof payload.count === "number") return payload.count;
    if (Array.isArray(payload.results)) return payload.results.length;
    return null;
  }

  if (!supabaseClient) {
    if (!state.missingBackendNotified) {
      toast("Keine API oder Supabase konfiguriert", { duration: 5000 });
      state.missingBackendNotified = true;
    }
    return null;
  }

  let builder = supabaseClient.from("items").select("id", { count: "exact", head: true });
  if (query) {
    builder = builder.ilike("name", `%${query}%`);
  }
  if (filters.item_type) {
    builder = builder.eq("item_type", filters.item_type);
  }
  if (filters.rarity) {
    builder = builder.eq("rarity", filters.rarity);
  }

  const { count, error } = await builder;
  if (error) throw error;
  return count ?? 0;
};

const handleAvatarAction = async (action) => {
  switch (action) {
    case "login":
      if (!supabaseClient) {
        toast("Supabase Konfiguration fehlt", { duration: 5000 });
        return;
      }
      try {
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        await supabaseClient.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo }
        });
      } catch (error) {
        console.error(error);
        toast("Anmeldung fehlgeschlagen", { duration: 5000 });
      }
      break;
    case "profile":
      updateProfilePanel();
      openProfilePanel();
      break;
    case "logout":
      if (!supabaseClient) {
        toast("Supabase Konfiguration fehlt", { duration: 5000 });
        return;
      }
      try {
        await supabaseClient.auth.signOut();
        toast("Erfolgreich abgemeldet", { duration: 4000 });
      } catch (error) {
        console.error(error);
        toast("Abmelden fehlgeschlagen", { duration: 5000 });
      }
      break;
    default:
      break;
  }
};

const updateProfilePanel = () => {
  if (!state.user || !elements.profileEmail || !elements.profileId) return;
  elements.profileEmail.textContent = state.user.email ?? "-";
  elements.profileId.textContent = state.user.id ?? "-";
};

const handleItemSubmit = async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    toast("Supabase Konfiguration fehlt", { duration: 5000 });
    return;
  }
  if (!state.user) {
    toast("Bitte per Discord anmelden", { duration: 5000 });
    openAvatarDropdown();
    return;
  }

  const formData = new FormData(elements.itemForm);
  const name = (formData.get("name") || "").toString().trim();
  const itemType = formData.get("item_type");
  const rarity = formData.get("rarity");
  const starLevelValue = formData.get("star_level");
  const priceValue = formData.get("price");
  const imageUrl = (formData.get("image_url") || "").toString().trim();

  if (!name) {
    toast("Name ist erforderlich", { duration: 4000 });
    return;
  }

  if (!itemType) {
    toast("Item-Art auswählen", { duration: 4000 });
    return;
  }

  if (!rarity) {
    toast("Seltenheit auswählen", { duration: 4000 });
    return;
  }

  const starLevel = Number.parseInt(starLevelValue, 10) || 0;
  if (starLevel < 0) {
    toast("Stern-Level muss ≥ 0 sein", { duration: 4000 });
    return;
  }

  const price = priceValue ? Number.parseFloat(priceValue) : null;
  if (price !== null && price < 0) {
    toast("Preis muss ≥ 0 sein", { duration: 4000 });
    return;
  }

  const selectedEnchantments = formData.getAll("enchantments");
  const enchantmentPayload = [];

  for (const enchantmentId of selectedEnchantments) {
    const def = state.enchantments.find((ench) => String(ench.id) === String(enchantmentId));
    const levelRaw = formData.get(`enchantment-level-${enchantmentId}`);
    const level = Number.parseInt(levelRaw, 10);
    if (!def) continue;
    const maxLevel = def.max_level ?? 1;
    if (!level || level < 1 || level > maxLevel) {
      toast(`Level für ${def.name} muss zwischen 1 und ${maxLevel} liegen`, { duration: 5000 });
      return;
    }
    enchantmentPayload.push({
      enchantment_id: def.id,
      level
    });
  }

  elements.modalSubmit.disabled = true;
  const originalText = elements.modalSubmit.textContent;
  elements.modalSubmit.textContent = "Speichern…";

  try {
    const { data, error } = await supabaseClient
      .from("items")
      .insert([
        {
          name,
          item_type: itemType,
          rarity,
          star_level: starLevel,
          price,
          image_url: imageUrl || null,
          creator: state.user.id
        }
      ])
      .select("id")
      .single();
    if (error) throw error;

    if (enchantmentPayload.length) {
      const rows = enchantmentPayload.map((row) => ({
        item_id: data.id,
        enchantment_id: row.enchantment_id,
        level: row.level
      }));
      const { error: linkError } = await supabaseClient
        .from("item_enchantments")
        .insert(rows);
      if (linkError) throw linkError;
    }

    toast("Item gespeichert", { duration: 4000 });
    closeItemModal();
    elements.itemForm.reset();
    performSearch();
  } catch (error) {
    console.error(error);
    toast(error.message || "Speichern fehlgeschlagen", { duration: 5000 });
  } finally {
    elements.modalSubmit.disabled = false;
    elements.modalSubmit.textContent = originalText;
  }
};

const renderAvatar = () => {
  if (!elements.avatarButton) return;
  const inner = elements.avatarButton.querySelector(".avatar-button__inner");
  if (!inner) return;
  inner.innerHTML = "";
  inner.classList.remove("avatar-button__inner--image", "avatar-button__inner--initials");
  elements.avatarButton.classList.remove("avatar-button--image");

  if (!state.user) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("icon");
    svg.dataset.icon = "user";
    inner.appendChild(svg);
    elements.avatarButton.setAttribute("title", "Gastkonto");
    inlineExternalIcons();
    return;
  }

  const metadata = state.user.user_metadata || {};
  const avatarUrl = metadata.avatar_url || metadata.picture || metadata.avatar;
  const displayName = metadata.full_name || metadata.name || metadata.preferred_username || state.user.email || "User";

  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "";
    img.className = "avatar-button__image";
    inner.appendChild(img);
    inner.classList.add("avatar-button__inner--image");
    elements.avatarButton.classList.add("avatar-button--image");
  } else {
    const initials = displayName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();
    inner.textContent = initials || "U";
    inner.classList.add("avatar-button__inner--initials");
  }

  elements.avatarButton.setAttribute("title", displayName);
};

const escapeHTML = (value) => {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
};

const renderAvatarDropdown = () => {
  if (!elements.dropdownContent) return;
  let html = "";

  if (!state.user) {
    html = `
      <button class="dropdown__item" type="button" data-action="login" role="menuitem">
        Mit Discord anmelden
      </button>
    `;
  } else {
    const metadata = state.user.user_metadata || {};
    const displayName = metadata.full_name || metadata.name || metadata.preferred_username || state.user.email || "Nutzer";
    const email = state.user.email ? `<span class="dropdown__user-meta">${escapeHTML(state.user.email)}</span>` : "";
    html = `
      <div class="dropdown__user" role="presentation">
        <span class="dropdown__user-name">${escapeHTML(displayName)}</span>
        ${email}
      </div>
      <div class="dropdown__separator" role="none"></div>
      <button class="dropdown__item" type="button" data-action="profile" role="menuitem">Profil</button>
      <button class="dropdown__item" type="button" data-action="logout" role="menuitem">Abmelden</button>
    `;
  }

  elements.dropdownContent.innerHTML = html;
};

const attachEventListeners = () => {
  elements.sidebarToggle?.addEventListener("click", toggleSidebar);

  elements.avatarButton?.addEventListener("click", () => {
    if (elements.avatarDropdown.dataset.open === "true") {
      closeAvatarDropdown();
    } else {
      renderAvatarDropdown();
      openAvatarDropdown();
    }
  });

  elements.avatarDropdown?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    handleAvatarAction(action);
    closeAvatarDropdown();
  });

  elements.searchInput?.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    debouncedSearch();
  });

  elements.searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.searchQuery = elements.searchInput?.value || "";
    performSearch();
  });

  elements.filterButton?.addEventListener("click", () => {
    if (state.isFilterOpen) {
      closeFilterPopover();
    } else {
      openFilterPopover();
    }
  });

  elements.filterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(elements.filterForm);
    state.filters.item_type = formData.get("item_type") || "";
    state.filters.rarity = formData.get("rarity") || "";
    updateFilterButtonState();
    closeFilterPopover();
    performSearch();
  });

  elements.resetFilters?.addEventListener("click", () => {
    if (!elements.filterForm) return;
    elements.filterForm.reset();
    state.filters.item_type = "";
    state.filters.rarity = "";
    updateFilterButtonState();
    performSearch();
  });

  elements.filterClose?.addEventListener("click", () => {
    closeFilterPopover();
    elements.filterButton?.focus();
  });

  elements.addItemButton?.addEventListener("click", () => {
    openItemModal();
  });

  elements.modalCloseTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      closeItemModal();
    });
  });

  elements.itemForm?.addEventListener("submit", handleItemSubmit);
  elements.itemForm?.addEventListener("reset", resetEnchantmentLevels);

  elements.profileClose?.addEventListener("click", () => {
    closeProfilePanel();
    elements.avatarButton?.focus();
  });

  window.addEventListener("resize", () => {
    if (state.isFilterOpen) {
      closeFilterPopover();
    }
  });
};

const debouncedSearch = debounce(() => {
  state.searchQuery = elements.searchInput?.value || "";
  performSearch();
}, 300);

const initAuth = async () => {
  if (!supabaseClient) {
    renderAvatar();
    renderAvatarDropdown();
    return;
  }

  try {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();
    state.user = session?.user ?? null;
    renderAvatar();
    renderAvatarDropdown();
  } catch (error) {
    console.error(error);
    toast("Konnte Auth-Status nicht laden", { duration: 5000 });
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user ?? null;
    renderAvatar();
    renderAvatarDropdown();
    if (!state.user) {
      closeProfilePanel();
    }
  });
};

const init = () => {
  inlineExternalIcons();
  initSidebarState();
  updateFilterButtonState();
  setResultInfo();
  attachEventListeners();
  initAuth();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
