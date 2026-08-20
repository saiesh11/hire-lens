import type { SortOption, Theme } from "./types";

const THEME_KEY = "hirelens-theme";
const SORT_KEY = "hirelens-default-sort";

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies the stored (or system-fallback) theme immediately — call once, before React renders, to avoid a flash of the wrong theme. */
export function applyStoredTheme() {
  applyThemeClass(getPreferredTheme());
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyThemeClass(theme);
}

const VALID_SORTS: SortOption[] = ["score-desc", "score-asc", "newest", "recommendation"];

export function getDefaultSort(): SortOption {
  const stored = localStorage.getItem(SORT_KEY);
  return VALID_SORTS.includes(stored as SortOption) ? (stored as SortOption) : "score-desc";
}

export function setDefaultSort(sort: SortOption) {
  localStorage.setItem(SORT_KEY, sort);
}
