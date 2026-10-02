// Menu items are built in Rust (src-tauri/src/menu.rs), which emits one event
// per item. Each id below maps to one handler in App.tsx.
export const MENU_EVENTS = [
  "menu://app/settings",
  "menu://view/toggle-theme",
  "menu://view/section/tokens",
  "menu://view/section/primitives",
  "menu://view/section/composites",
  "menu://view/section/native",
] as const

export type MenuEvent = (typeof MENU_EVENTS)[number]
