# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(A desktop macOS app. The UI is web technology inside Electron, built on Eclipse Theia. There is no public
website.)

## Stack

Eclipse Theia 1.76 (TypeScript, React widgets, inversify DI), packaged with Electron for macOS (Apple Silicon).
herdr is an external CLI/TUI dependency. See `docs/DECISIONS.md` D1–D7.

## Users

One developer (the owner) working on several side and client projects at once: typically 4–8 active projects,
all kept under `~/Desktop/projects`. They do most of the implementation through Claude Code sessions in the
terminal, and use the editor to read, review and make small edits. They found VS Code too complex, and disliked
opening a separate window per project.

## Product Purpose

One window for every active project. Browse any project's files, edit them, and start a coding agent in any
folder with a single click. Agents run in herdr, which keeps them alive when the IDE closes and shows which ones
are working, blocked or done. Success means the owner never opens a second IDE window, and gets from "I want
Claude in this folder" to a running session in one click.

## Positioning

An IDE whose agent layer is **herdr + the Claude Code CLI**, not an agent built into the IDE. The projects tree's
**+** turns any folder into a new herdr tab in that project's own herdr workspace. The editor stays a full IDE
(LSP, git, debugger, VS Code extensions via Open VSX) without an AI chat getting in the way.

## Operating Context

- It is used all day, alongside Claude Code sessions that run for long stretches. The user switches between
  projects often.
- herdr's own keyboard model (prefix `ctrl+b`) must keep working inside the IDE.
- Single user, local machine, macOS only. No accounts, no telemetry, no cloud features.

## Capabilities and Constraints

- Layout: left (search, git, debug) · editor · herdr · Projects (right).
- Projects come from scan roots (asked for on first run, several allowed) plus projects added by hand. They can be
  hidden or shown with an eye toggle.
- The startup command for new herdr tabs is a global setting with per-project overrides, stored in Corral's
  settings, never in the repos.
- Theia AI is included but disabled.
- Extensions come from Open VSX only.

## Brand Commitments

- The name is **Corral** (a pen for a herd, because it hosts herdr). The icon is `branding/icon.svg`: a terminal
  prompt inside an enclosure with an open gate, in phosphor green on near-black.
- The owner's stated feel: dark, "a typical developer, more terminal feel".
- Voice: terse, lowercase-friendly, technical. No marketing adjectives inside the app.

## Evidence on Hand

None yet. No screenshots, users or metrics exist, and none should be invented. Screenshots are produced in plan
task T3.4.

## Product Principles

1. **The terminal is a first-class citizen.** herdr gets half the main area by default, and nothing steals its
   keystrokes.
2. **One click to an agent.** Any folder → a running agent, with no dialogs in between.
3. **Never touch what we didn't create.** Corral leaves the user's existing herdr workspaces and project repos
   alone.
4. **Quiet chrome.** The UI recedes; code and terminal output carry the colour.

## Accessibility & Inclusion

Full keyboard operation of the Projects view (arrows, Enter, ⌥⌘T), visible focus rings, and at least WCAG AA
contrast for text on every surface. Honour macOS "reduce motion".
