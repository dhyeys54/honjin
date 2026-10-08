---
name: Honjin
description: A dark, terminal-first IDE shell for many projects and their herdr agents.
colors:
  bg: "#0c0f0e"
  surface: "#0f1312"
  surface-raised: "#151a18"
  line: "#1f2624"
  line-strong: "#2b3431"
  selection: "#1d2b20"
  fg: "#c8d0cc"
  fg-muted: "#7d8984"
  fg-faint: "#525c58"
  accent: "#8fe388"
  accent-deep: "#4f7f4b"
  warning: "#e0b45a"
  danger: "#e5736b"
  info: "#6cc5d6"
  ansi-black: "#0c0f0e"
  ansi-red: "#e5736b"
  ansi-green: "#8fe388"
  ansi-yellow: "#e0b45a"
  ansi-blue: "#7aa7e0"
  ansi-magenta: "#c69be8"
  ansi-cyan: "#6cc5d6"
  ansi-white: "#c8d0cc"
  ansi-bright-black: "#525c58"
  ansi-bright-red: "#f0948d"
  ansi-bright-green: "#b1f0ab"
  ansi-bright-yellow: "#f0cd84"
  ansi-bright-blue: "#9cc0f0"
  ansi-bright-magenta: "#dab8f5"
  ansi-bright-cyan: "#94dbe8"
  ansi-bright-white: "#eef3f0"
typography:
  ui:
    fontFamily: "JetBrains Mono, SF Mono, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
  code:
    fontFamily: "JetBrains Mono, SF Mono, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  tree-row:
    textColor: "{colors.fg}"
    typography: "{typography.ui}"
    height: "22px"
  tree-row-selected:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.fg}"
  new-tab-button:
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.sm}"
    size: "18px"
  new-tab-button-hover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.accent}"
  view-title:
    textColor: "{colors.fg-muted}"
    typography: "{typography.label}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
---

# Design System: Honjin

## Overview

A terminal that grew an IDE around it. Everything is monospace, flat and dark. The chrome is quiet enough that
syntax colours and terminal output are the only loud things on screen. The one signature colour is **phosphor
green** (`accent`), taken from the app icon. It marks the live and actionable: the focused element, the `+`
action on hover, and an agent that is working. Starting mood: an old green-phosphor terminal, rendered with modern
restraint.

Stage 3 (`honjin-polish` skill) may refine these values. Change this file first, then the code.

## Colors

### Primary
- `accent` #8fe388: focus, the active tab indicator, `+` on hover, primary buttons.
- `accent-deep` #4f7f4b: the accent at rest on large areas (the active tab underline, progress).

### Neutral
- `bg` is the editor and terminal background. `surface` is the side panels, tab strip and status bar.
  `surface-raised` is menus, quick input, hover rows and notifications.
- `line` is the 1px hairline between regions. `line-strong` is input borders and the inactive tab separators.
- Text: `fg` for body, `fg-muted` for secondary text and view titles, `fg-faint` for disabled text and hints.

### Signals
- `warning` means blocked/needs input; `danger` means errors and destructive actions; `info` means links and
  notices.
- Git changes (spec 09 C13): modified `warning`, added/untracked `info`, deleted and conflicts `danger`. The pulsing
  `accent` dot on a file being written right now is the "agent that is working" use of the accent.
- The resource entry in the status bar (spec 10) turns `warning` (background, `bg` text) when memory is high or a process
  runs away, and `danger` when memory is very high. It is the theme's `statusBarItem.warning*` / `error*` colours.

### Named Rules
- **One green thing per region.** At most one accent-coloured element should be at rest in any region. Hover and
  focus may add a second.
- **No new colours.** Terminal ANSI colours are the syntax palette too. If a colour isn't in the frontmatter, it
  doesn't ship.
- Alpha variants are allowed only as a token plus a 2-hex alpha suffix (for example `#8fe38833` for a selection
  wash).

## Typography

Everything is monospace, for a terminal feel. `ui` covers all chrome text, `label` covers view titles and section
headers (UPPERCASE, tracked), and `code` covers the editor and terminal. No bold in chrome except `label`
(weight 500). Numbers in the status bar use tabular figures (monospace already does this).

## Layout

- Four regions: left panel (collapsed by default) · editor · herdr · Projects (300px). The main area is split
  50/50.
- The spacing scale is 4/8/12/16. Tree indent is 12px per level. Row height is 22px everywhere (tree, lists, tabs
  are 30px).
- Regions are separated by 1px `line` borders only. No gaps, gutters or cards.

## Elevation & Depth

Flat. No drop shadows on panels or tabs. Overlays (menus, quick input, notifications) sit on `surface-raised`
with a 1px `line-strong` border. Use a single soft shadow only if a detached overlay can't otherwise be told
apart.

## Shapes

Square by default (`rounded.none`) for panels, tabs and rows. `rounded.sm` for buttons, inputs and the `+`
button. `rounded.md` only for overlays.

## Components

### Projects tree row
22px high, 12px indent per level. The project root rows use `ui` in `fg` with the tail showing the path in
`fg-faint` when the view is wider than 320px. Selected rows get the `selection` background; the focused row adds a
1px inset `accent` outline. Hidden roots render at 50% opacity; missing roots are struck through in `fg-faint`.

### + button (new herdr tab)
18×18 glyph `+` with a hit area of at least 22px, at the right edge of a directory row. It is invisible at rest
and appears on row hover or focus-visible without shifting the layout. On hover it gets the `surface-raised`
background and the `accent` glyph. Tooltip and `aria-label` text: spec 03.

### View titles
The `label` style, `fg-muted`. Toolbar icons use `fg-muted`, switching to `fg` on hover.

### Tabs
Square and 30px high. The active tab uses the `bg` background with a 1px `accent-deep` top indicator; inactive
tabs use `surface`. The herdr tab has no close button.

## Do's and Don'ts

### Do:
- Keep the terminal and editor backgrounds identical (`bg`), so editor | herdr reads as one surface.
- Use motion only for state feedback (≤120ms, opacity/transform), and honour reduce-motion.
- Keep text contrast at AA or better. Measured: `fg` 11.9:1 and `fg-muted` 5.2:1 on `surface`. On `selection`
  rows `fg-muted` drops to 4.1:1, so selected rows switch secondary text to `fg`. `fg-faint` (2.7:1) is only for
  disabled or purely decorative text, never information you need to read.

### Don't:
- No gradients, glassmorphism, glow or neon effects in the chrome (the icon's glow stays in the icon).
- No emoji or illustrated empty states. An empty state is one line of text and a button.
- No rounded "card" containers inside panels.
