# Theme system

The site supports **light** and **dark** themes using Figma **Use Colors** variables from file `cpLveNkdlW6XRiHClNtgWn` (UK Personal library, `Base Colors` / `Brand Colors`).

## How theme is chosen

1. **Saved preference** — `localStorage.theme` is `"light"` or `"dark"` after the user clicks the segment control.
2. **System default** — if nothing is saved, `prefers-color-scheme` decides (`dark` → dark theme, otherwise light).
3. **System sync** — OS theme changes apply only while the user has **not** set a manual preference.

## DOM contract

- `<html data-theme="light">` or `<html data-theme="dark">` is the single switch.
- An inline `<script>` in `<head>` (before CSS) sets `data-theme` synchronously to avoid a flash of the wrong theme.
- [`js/theme.js`](../js/theme.js) handles segment clicks, `localStorage`, and system listener updates.

## CSS tokens

All semantic colors live in [`css/tokens.css`](../css/tokens.css):

- `:root` — light mode (Use Colors / Light)
- `:root[data-theme="dark"]` — dark mode (Use Colors / Dark)

Components must use tokens (`--fill-bg-*`, `--text-neutral-*`, `--action-*`, `--stroke-*`, etc.), not raw hex.

Radius tokens for the theme control: `--radius-3` (track), `--radius-4` (segment).

## Segment control (Figma)

| Item | Node ID |
|------|---------|
| Home frame (placement) | `12196:6100` |
| Segmented control instance | `12257:7793` |

- Fixed bottom-right: `right` / `bottom` = `--level-page-padding` (`2.5rem` on desktop).
- Size: `5.25rem × 2.75rem` (84×44px).
- ST Design kit **Segmented control** — sun = light, moon = dark.
- Styles: [`.theme-switch`](../css/components.css) in `components.css`.

## Figma MCP workflow

Before changing theme tokens:

1. Confirm Figma MCP is connected (see [Figma-fetch.md](Figma-fetch.md)).
2. Resolve **both** Light and Dark values from the **Use Colors** collection — e.g. `get_variable_defs` on a node in each mode, or `use_figma` to read resolved aliases from `Brand Colors`.
3. Update `tokens.css`; do not guess inverted palettes.

## Files

| File | Role |
|------|------|
| `css/tokens.css` | Light/dark CSS variables |
| `css/base.css` | `color-scheme`, page background dark tweaks |
| `css/components.css` | `.theme-switch` UI |
| `js/theme.js` | Preference + segment behavior |
| `index.html`, `404.html` | Inline init script, segment markup |
| `assets/images/theme-sun.svg`, `theme-moon.svg` | Figma icon sources (reference; UI uses inline SVG) |
