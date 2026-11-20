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
- SQLite is the only library database in both modes. Browser startup requires
  a local service session and has no dependency on legacy IndexedDB.
  (source: docs/data-and-backup.md)

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
  evidence, and before-and-after capture is no longer required.
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
- EPUB P0 integration uses an isolated reader document, per-book HTTP/custom-
  protocol resources, and a versioned original-archive/package field on Book.
  Legacy source-page coordinates are retained through checked reimport mapping.
  Scope, storage tradeoffs and validation limits, including desktop exit checks,
  are recorded in docs/epub-engine/p0-integration-2026-11-12.md.
- EPUB P1 adds worker-based ZIP/XML import, publication CSS/font restoration,
  font deobfuscation, single-viewport fixed layout, logical RTL/vertical axes,
  on-demand binary resources, and summary/single-book reads. Scope, dependencies,
  implementation choices and verification states are recorded in
  docs/epub-engine/p1-implementation-2026-11-12.md. The owner restricted functional
  validation for this conversation to ChatGPT's built-in browser on 2026-11-12.
  Desktop execution and package verification remain unverified for P1.
- Later compatibility checks on 2026-11-12 passed the source desktop core flow,
  NSIS build and static package verification. Packaged EPUB workers/resources and
  reload passed, but normal process shutdown still failed; no installation was
  performed. Evidence and the remaining release blocker are recorded in
  docs/archive/verification/electron-compatibility-2026-11-12.md.
- On 2026-11-13, the destroyed-window Wiki cleanup and delayed close callbacks
  were fixed, and closed publication workers were made terminal. Source reading,
  failed-save close protection, and standalone packaged EPUB close/restart checks
  passed with exact data preservation. This supersedes the earlier shutdown
  blocker for these tested paths; installation remains unverified. Evidence:
  docs/archive/verification/electron-lifecycle-2026-11-13.md.
- Font behavior confirmed by the owner on 2026-11-12: Auto selects application
  fonts by publication language. The existing Book font menu item now selects
  publisher fonts through a persisted original-font preference, including fixed
  layout. Browser verification is recorded in the P1 implementation document.
- Reflowable image pagination places page gutters on the reading root and fits
  images within the remaining content height. Scroll mode clears paged offsets
  and restores flowing media height. Real-book verification and related height
  cleanup are recorded in the P1 implementation document.
- Reading Settings now includes session-only line spacing and reading width in
  the existing panel. Scoped publisher-style overrides, effective notes-aware
  geometry, source-offset reflow recovery, and fixed-layout exclusions are
  implemented. The owner authorized ego-browser Web validation on 2026-11-13
  after built-in browser access failed; no desktop execution was tested for this
  feature. Evidence: docs/epub-engine/reading-settings-implementation-2026-11-13.md.
- client persistence adapters: src/client/infrastructure/
- Candidate `22d5785` later passed standalone packaged reading-settings/Paper
  checks and normal close/restart on 2026-11-13. NSIS payload, ASAR and runtime
  reports belong to this candidate; installation remains unverified. Evidence:
  docs/archive/verification/electron-candidate-22d5785-2026-11-13.md.
- local server and data store: src/server/
- Electron entry and integration: src/desktop/
- validation scripts and tests: scripts/, tests/

(source: docs/development.md, inspected source paths)

## Product and design sources
- Wiki MVP: docs/product/wiki/feature-spec.md; independent Figma Wiki Sidebar
  component `236:1614` on 02 - Components in `eib6b1sDBsFa7hTzY2Zmsi`
  (converted from original dialog `194:1665`). Scope: literal-title lookup with
  existing redirects and manual switching among the article's linked language
  editions. No candidate search, entity discovery, or automatic translation.
  Decision: docs/product/decisions/2026-11-05-wiki-mvp.md. Implemented in source;
  validation and remaining desktop/package checks: docs/product/wiki/implementation.md.
  Later owner comments on 2026-11-05 updated Figma to a right notes-area sidebar,
  an underlined query and a six-language dropdown; these are implemented in source
  as a 337 × 341 sidebar, fixed at the margin-note horizontal position. Built-in
  browser scroll-position verification completed on 2026-11-06; desktop exit and
  package limitations remain in the implementation record. Current scope:
  docs/product/wiki/feature-spec.md.
  The owner subsequently requested standalone component organization: Reading
  Interface `15:129` is restored and Wiki is maintained separately on 02 - Components.
- Goal positioning: docs/goal-positioning-correction-2026-10-27.md
- Goal user input and Response MVP: docs/product/goals/user-input-response/feature-spec.md.
  Owner-confirmed requirements, 2026-11-09: a unified Goal content area without
  the separate Linked group marker; preserve Highlight/Note Link components;
  offer only the optional, Goal-specific Response label. The unified content
  area retains the former Link group's position below child Goals and shows
  newly added content first. On 2026-11-10 the owner confirmed passive region
  icons and independent multiline records owned by their creating Goal. The
  original Figma Sidebar now integrates the module; UX states and inherited
  editing behavior: docs/product/goals/user-input-response/interaction.md.
  On 2026-11-10, source implementation added owned records, unified content order,
  passive region icons, inline editing and recovery. Owner confirmed records follow
  Goal archive/delete/restore and are removed on purge; per-book backups exclude
  them. SQLite schema is now v5. Home workspace entry remains deferred by explicit
  owner choice; that initial delivery reserved Response metadata only. Validation and delivery boundaries:
  docs/product/goals/user-input-response/implementation.md.
- Response design composition (owner-approved, 2026-11-10): selected light neutral
  content blocks with a stronger Response label. Figma now has independent Label,
  Item, List and Panel components on 02 - Components; review `302:2181` in
  `eib6b1sDBsFa7hTzY2Zmsi`. Existing User input review `288:1835` uses the item/list
  composition. Original Sidebar `14:581` retains its five variants and User input
  property; the new Panel does not replace it. Structure, preserved content,
  changed nested instance IDs and validation: docs/product/goals/user-input-response/design.md.
  The owner subsequently chose a Readwise Reader-style icon-only tag entry that
  opens a compact menu to the left, with one checkable Response option for both
  marking and removal. Functional requirements and local interaction defaults
  are recorded in feature-spec.md sections 5.6-5.9 and interaction.md section 5 in
  that directory. Subsequent Figma UX work created Tag Control `312:2418`, Menu
  `312:2443`, Save Feedback `312:2461` and six Item interaction variants, but hit
  the MCP Starter tool-call quota before integration and visual QA. Feedback
  property bindings and closed-menu transitions still need correction; the new
  UX review has not been created. Resume evidence: .local-materials/response-ux-state.json.
  Current partial delivery and limitations: design.md in that feature directory.
  On 2026-11-11, all six item feedback bindings and closed-menu opacity were
  confirmed corrected through the Figma Scripter UI. Review `325:2747` is partial;
  completing its contexts/states and prototype/visual validation remains pending.
  Response source integration is now implemented in the reader sidebar and existing
  full Goal workspace. The owner confirmed that Response follows the current Goal's
  association: restoring the original retains it; a fresh association starts unmarked.
  Persistence uses the existing outbox and optional intent metadata, with no schema
  change. Validation and delivery limits:
  docs/product/goals/user-input-response/response-implementation.md.
- Goal behavior contract: docs/archive/plans-and-implementation/goal-system-implementation-plan.md
- cross-book Goal and shared editor:
  docs/archive/plans-and-implementation/goal-cross-book-sidebar-plan.md
- book and material relationships: docs/archive/plans-and-implementation/goal-books-module-design.md
- Current UI/UX specification: docs/design/design-system.md. It owns global
  principles, authority, scoped component/interaction constraints, and Open items.
- Figma navigation and design status: docs/design/design-index.md.
- Approval history: docs/product/decisions/README.md; workspace approvals are in
  docs/product/decisions/2026-10-29-workspace-ui-decision.md.
- Product language and copy: docs/design/design-system.md#feedback-and-product-copy.
  (source: owner-approved English unification, 2026-10-30)

## Artifact locations
- prototypes: docs/prototypes/.
- retained local materials: .local-materials/font-source/ for original fonts;
  .local-materials/pending-patches/ for retained patches. Both are git-ignored.
- retired document backup: .document-backups/deprecated-docs-2026-10-29.zip;
  local only and git-ignored.
- development commands and acceptance guidance: docs/development.md
- historical plans and implementation: docs/archive/plans-and-implementation/.
- acceptance and verification records: docs/archive/verification/.
- archive index and monthly cleanup policy: docs/archive/README.md.

(source: existing project documents; owner-stated maintenance rules, 2026-10-29)

## Delivery
- Windows x64 NSIS candidate packages are generated under release/.

(source: docs/development.md)

## Unknowns
- UI/UX details still open: see docs/design/design-system.md#open.
