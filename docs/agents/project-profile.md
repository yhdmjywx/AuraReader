# Project profile

verified: 2026-10-30 · owner rules: AGENTS.md

## Identity
- AuraReader: a reader centered on the reader achieving their own goals. Goal is
  the core; EPUB and other formats support it. Readers define and change their
  goals and decide how materials relate to them. (source: owner-stated, 2026-10-29)

## Stack
- React, TypeScript, Vite, and Base UI for the interface. Existing controllers and
  repositories retain application behavior and persistence responsibilities.
  No Tailwind or shadcn CLI is used. (source: package.json, docs/development.md)
- Electron for Windows x64 desktop; Node.js with built-in SQLite for local data.
  Browser mode uses a local HTTP service; desktop mode uses IPC without that
  service. Node.js >= 24.15.0 is required for source development.
  (source: package.json, docs/development.md)

## Commands
- development: `npm run dev`
- production build and strict type checks: `npm run build`
- type checks only: `npm run typecheck`
- syntax, unit, and regression suite: `npm test`
- current React integration checks: `npm run test:migration`
- desktop core workflow: `npm run test:desktop`
- focused reading workflow: `npm run test:reading-workflow`
- desktop preview: `npm run desktop`
- storage and recovery stability: `npm run test:stability`
- Windows candidate package: `npm run dist:win`

(source: package.json, scripts/test.cjs, docs/development.md)

## Validation baseline
- Code changes: production build and checks covering the changed behavior.
- Interface changes: use ChatGPT's built-in browser-use tool against the running
  web app. Exercise affected mouse and keyboard interactions, check visible
  outcomes, and verify saving or reload behavior when affected. Run automated
  checks relevant to the change; desktop checks are required only for changes
  involving Electron-specific behavior.
- Screenshots document the final appearance only. They are not interaction-test
  evidence, and before-and-after capture is no longer required. If browser-use
  verification is unavailable, report the gap rather than substitute screenshots.
- Storage, recovery, packaging, and installation have separate checks. Choose
  those relevant to the change; a successful build does not establish that an
  installer or recovery path works.

(source: docs/development.md; owner-approved browser-use validation, 2026-11-03)

## Code locations
- interface and application coordination: src/client/
- shared interface primitives: src/client/components/ui/
- workbench action-button variants: components/ui/button.tsx,
  components/ui/action-button.css, and components/ui/action-icon.tsx under
  src/client/. Vega recipes are adapted to the existing CSS build; SVG paths
  reuse the installed Remix Icon package.
- workbench presentation: src/client/features/workbench/
- shared Goal presentation: src/client/features/goals/goalUI.tsx
- reader runtime boundary: src/client/features/reader/readerRuntime.ts
- client persistence adapters: src/client/infrastructure/
- local server and data store: src/server/
- Electron entry and integration: src/desktop/
- validation scripts and tests: scripts/, tests/

(source: docs/development.md, inspected source paths)

## Product and design sources
- Goal positioning: docs/goal-positioning-correction-2026-10-27.md
- Goal behavior contract: docs/goal-system-implementation-plan.md
- cross-book Goal and shared editor:
  docs/goal-cross-book-sidebar-plan.md
- book and material relationships: docs/goal-books-module-design.md
- approved workspace changes:
  docs/product/2026-10-29-workspace-ui-decision.md
- UI/UX specification: docs/product/ui-ux-design.md. The visual and interaction
  baseline is approved; detailed measurements, action placement, and remaining
  decisions are listed under Open. shadcn/ui with the Vega classic style is the
  chosen visual baseline. Keep compatible presentation unchanged; Vega governs
  conflicts. Prefer direct reuse of official Vega code and styles as described
  in the UI/UX specification.
  This records a design decision, not a completed implementation or dependency
  migration. Do not treat the current interface as approval for disputed changes.

(source: owner-stated, 2026-10-29; existing project documents)

## Artifact locations
- prototypes: docs/prototypes/; retain the original when asked to make a copy.
- retained local materials: .local-materials/font-source/ for original fonts;
  .local-materials/pending-patches/ for retained patches. Both are git-ignored.
- retired document backup: .document-backups/deprecated-docs-2026-10-29.zip;
  local only and git-ignored.
- project facts: this file.
- UI/UX baseline: docs/product/ui-ux-design.md.
- approved workspace decisions:
  docs/product/2026-10-29-workspace-ui-decision.md
- development commands and acceptance guidance: docs/development.md
- progress and validation: use the relevant implementation or verification record
  under docs/; keep temporary status out of AGENTS.md.

(source: existing project documents; owner-stated maintenance rules, 2026-10-29)

## Conventions
- Product copy is English, including application feedback and generated export
  descriptions. Reader content and historical saved values retain their original
  language. Layout and interaction paths remain unchanged. Windows-owned dialog
  controls follow the system language. (source: owner-approved English unification,
  docs/product/ui-ux-design.md, 2026-10-30)
- New agent rules and project profiles: English.
- Owner-facing explanations, questions, and summaries: Chinese.
- Existing product documents retain their language unless translation is requested.

(source: owner-stated, 2026-10-29; existing project documents)

## Delivery
- Windows x64 NSIS candidate packages are generated under release/.
- Source changes and local validation do not establish that a new package was
  built, installed, or published. Report the artifact actually verified.

(source: docs/development.md)

## Unknowns
- UI/UX details still open: see docs/product/ui-ux-design.md#open.
