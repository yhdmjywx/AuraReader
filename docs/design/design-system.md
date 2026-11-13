# AuraReader Design System

The single current UI/UX specification. Consolidated on 2026-11-04 from existing
approved rules; no new product or visual design is introduced.
Use the [design index](design-index.md) for Figma navigation and design status,
and [decision records](../product/decisions/README.md) for approval history.
Permissions, code boundaries, and validation remain in [AGENTS.md](../../AGENTS.md).

## Design Philosophy

- The reader defines their own goals, relationships, and reading direction.
  Goal is an editable workspace with navigation; it can exist without books.
  Reading and annotation do not require a Goal.
- Opening a book, adding it to a Goal, and linking material remain distinct
  reader-directed actions. The sidebar and full Goal page share state and editor.
- Reduce redundant controls and avoid adding steps. Keep actions related to their
  content and in familiar places. Common actions are directly visible; others are
  reachable through one menu. Unresolved grouping remains Open.

Product basis: [Goal positioning](../goal-positioning-correction-2026-10-27.md)
and [book relationships](../archive/plans-and-implementation/goal-books-module-design.md).

## Design Authority

| Source | Responsibility |
| --- | --- |
| Explicit Figma product screens, instances, and states | Primary visual layout and appearance for the corresponding scope; follow contextual instances over component defaults |
| This Design System | Current global principles, project-specific exceptions, interaction constraints, and Open questions |
| Approved decision records | Approval scope, changes, and necessary historical reasons; earlier wording yields to later approvals consolidated here |
| shadcn/ui Vega | Component foundation and fallback for details left unspecified by Figma and approved rules |
| Existing Code | Real business behavior, data relationships, state, saving, and reader interaction; its appearance alone does not establish approval |
| Figma Foundations / extraction documentation | Existing Implementation Reference; extracted values are not newly approved global tokens |
| Exploration / historical prototypes | Context within their original scope; no automatic approval |

Before UI/UX work, read this document and the [design index](design-index.md),
then locate the applicable frame, instance, and states. Follow explicit Figma
visuals over Vega defaults or personal preference. For unspecified details, reuse
documented rules and compatible project components, then Vega defaults.
Report an ambiguity when these sources give no reasonable basis or when Figma
conflicts with a scoped approval or product invariant; do not silently discard
either source or invent global rules.

The extraction's historical source-authority statement describes its provenance.
Current explicit Figma visuals govern appearance; code retains real behavior.
Example books, Goal text, and settings are not application defaults. A visual
reference does not authorize changes outside the task or to primary interaction
paths; follow the agent contract.

## Visual Direction

- Use the approved light, neutral, high-contrast appearance: light backgrounds,
  dark text and icons; black, white, and gray dominate. Blue remains a small cue.
- Preserve regional separation with a light gray app background and white content
  surfaces. Use borders and light elevation without making every region a card.
- Retain compatible rounding and comfortable spacing. Use explicit scoped design,
  then Vega geometry/density; no universal pills, square corners, enlargement,
  or application-wide scaling.
- Express hierarchy through grouping, indentation, typography, and neutral states.
  Page dimensions and extracted CSS literals do not establish global token scales.

## Design Foundation

shadcn/ui **Vega**, the classic style, is the selected foundation. Prefer official
Vega code, theme tokens, and styles using the compatible Base UI version. Adapt
existing actions with the smallest integration and reuse compatible components;
avoid parallel approximations, repeated CSS overrides, or unnecessary variants.
The current CSS/dependency setup is an implementation fact, not a completed
migration or a requirement to recreate Vega by hand. Supporting dependencies and
styles change only within an authorized implementation task.
Other shadcn styles and previously explored libraries remain historical references.

## Component Principles

- Use appropriate primary, secondary, ghost, and destructive variants. Ghost
  actions have no persistent background and use neutral hover feedback.
- Preserve distinct selected, checked, active, focus, disabled, editing, loading,
  and unavailable states where applicable. Opening a menu/panel alone is not an
  enabled toggle and must not give its trigger a dark solid fill.
- Menus use neutral highlight, checkbox/radio items for choices, separators for
  groups, and destructive treatment where applicable. Icons are optional; show
  existing shortcuts on the right without inventing icons or shortcuts.
- Prefer icon-only familiar toolbar actions with tooltips; use labels where needed
  for clarity. Keep accessible names, keyboard/focus handling, disabled semantics,
  native text selection, IME input, and access without hover.
- Use the indexed contextual instance as well as the base component. Scoped
  dimensions and editor exceptions below do not apply to unrelated components.

## Workbench and Reading

- Keep the Goal sidebar control in the left brand/Goal area, accessible there when
  the sidebar is closed. Opening the full Goal page is a separate action.
  The reading-settings trigger remains icon-only; the EPUB enlargement entry stays removed.
- Keep workbench actions and badges neutral while retaining the brand color.
  Use one SVG family for workbench actions, reusing installed Remix Icon paths
  and existing shared primitives. Apply to Goal navigation, sidebar, book/library,
  contents, reading settings, export, pagination, and Settings; keep labels,
  commands, IDs, values, and placement except where explicitly approved below.
- Keep one pagination instance inside the existing book-actions toolbar, between
  the book title and right-side actions. No extra row/bar or bottom duplicate.
- On hover-capable devices, show the toolbar when the pointer enters its top area
  and hide it on leave. Reserve its space so reading content never shifts; retain
  access during keyboard focus, while a toolbar panel is open, and without hover.
  The white-Paper reference keeps its white at-rest workspace surface. For
  Sepia/Dark Paper, the reserved region behind a hidden toolbar follows Paper;
  the visible toolbar retains its existing application surface. The 52px slot
  and reading-content position remain unchanged. State references and Web validation:
  [Paper and toolbar states](reading-paper-toolbar-states-2026-11-13.md).
- The book title is single-line with ellipsis, at most 18ch wide and shrinkable.
  Preserve the full text and hover title; 18ch is a display width, not a data limit.
  Preserve the contents trigger and adjacent actions.
- Local Library shows book titles and remove actions without structure metadata,
  row separators, or the bottom service/backup hint. Keep search, import,
  sample-book access, removal confirmation, and errors. Shorter lists fit contents
  and the popover remains constrained by the viewport.
- Reading Settings preserves layout, values, commands, and preference behavior.
  Font choices are radio menu items with selection indication. Paper/layout choices
  use neutral active feedback. Paper swatches
  remain unlabeled at rest, selected, and hovered, with accessible names, tooltips,
  and focus. Control styling does not redefine document paper rendering.
- The ongoing Goal menu retains `complete`, `Archive`, and `Delete`;
  Delete opens the existing confirmation. Preserve menu keyboard behavior.

## Wiki Sidebar

- Use the independent [Wiki Sidebar component](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=236-1614)
  on 02 - Components. Maintain it separately from reading Screen frames; the owner
  requested restoration of the original Reading Interface on 2026-11-05.
  Preserve the owner's revised visual design. Default, menu-open, loading,
  not-found and request-failed states are shown as separate sidebar Frames on
  02 - Components, using instances of the unchanged main component.
  Runtime placement remains the reading interface's
  right notes area; while open, it covers notes in that area. Use the component's
  337 × 341 size and the margin notes' horizontal offset from book text; keep its
  position fixed while the book scrolls. Retain the query text, body, language selector and top-right
  diagonal original-article arrow. Exit stays at the entry point, not the top right.
- Query text is editable and submitted with Enter; no separate Search button.
  Use unboxed text with a persistent gray bottom line, not an outlined input.
  Body content scrolls independently of the top controls. Indent each paragraph's
  first line by two character widths with scoped `text-indent: 2em`, not stored spaces.
- The dropdown's language range is Simplified Chinese, English, Traditional Chinese,
  French, German and Spanish. Reuse the project's neutral radio-menu treatment,
  13px text and roughly 34.2px item rows. Available editions still come from the
  current article's language links; the Chinese choices are display variants of
  the same Chinese Wikipedia site, not separate encyclopedia sites.
  Do not add candidate search, entity discovery, automatic translation, a separate
  source-language selector, or extra persistent feature panels. Status feedback uses the body.
- Placeholder text and the nested Local Library surface instance do not supply business
  behavior. The independent component contains the six-option dropdown;
  source implementation adopted the sidebar design, with built-in browser
  scroll-position verification recorded on 2026-11-06.
  See the [current specification](../product/wiki/feature-spec.md),
  [design index](design-index.md), and [owner clarification](../product/decisions/2026-11-05-wiki-mvp.md).

## Goal Hierarchy and Materials

Applies to the shared reading sidebar and full Goal workspace unless distinguished.

- On 2026-11-09 the owner confirmed the
  [Goal user input and Response MVP](../product/goals/user-input-response/feature-spec.md).
  The target design removes the separate Linked group and its group marker,
  presenting direct user input with Highlight and Note content. Preserve their
  existing Link components, source relationships and actions, and distinguish
  child-Goal navigation, unlinking and deleting user-authored content. The MVP
  supplies only an optional, Goal-specific Response label; it neither completes
  a Goal nor creates a separate group. The unified content area retains the
  former Link group's layout position below child Goals; newly added content
  appears first within that area. MVP Response does not pin; approved future
  priority rules are recorded in the feature spec. Owned input and region UI
  and Response controls are integrated in source; see the scoped
  [Response implementation record](../product/goals/user-input-response/response-implementation.md).
  On 2026-11-10 the owner selected a light neutral content block with a stronger
  Response label and authorized an initial component composition. Independent
  label, item, list and panel components now exist in Figma; the original Sidebar
  retains its property contract and has not been replaced by the new panel.
  See the scoped [Response design record](../product/goals/user-input-response/design.md#response独立组件与初步组合2026-11-10).
  The owner subsequently chose an icon-only tag entry that opens a compact menu
  to its left, containing one checkable Response option. Opening the menu does
  not toggle the label; selecting the option adds or removes it. Retain the
  display-only Response Label. Local spacing, existing motion, focus and save
  feedback requirements are specified in the
  [Response interaction contract](../product/goals/user-input-response/interaction.md#5-response-标签入口与菜单需求补充).
  Figma menu/control/feedback components are partially authored; property fixes,
  integrated states and prototype/visual QA remain pending after an MCP quota
  interruption. Source implementation now follows the requirements and the owner's
  supplied screenshot; Figma itself was not changed during implementation.
  See the [implementation record](../product/goals/user-input-response/implementation.md).

- The owner selected scheme 02, region icons with a horizontal divider, from the
  [HTML comparison](../prototypes/goal-content-identifiers.html). Retain original
  Figma typography and the parent Goal's medium weight, without a target icon.
  A branch icon identifies child Goals; a stacked-document icon identifies the
  content area, with a document-plus add entry on its right. This supersedes the
  earlier text-entry choice for this MVP. Omit module-title text and the hierarchy
  guide spanning the content area; preserve existing quote rules and material
  components. The separate
  [static design Frame](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=265-1744)
  applies the selected arrangement using existing styles and tokens. It remains
  a retained layout reference. On 2026-11-10 the owner requested integration
  into the original Sidebar; its component and variant IDs are retained while
  its content area is updated. See the
  [design record](../product/goals/user-input-response/design.md).

- User-input integration (2026-11-10): branch and stacked-document region icons
  are identifiers only. Records are independent, multiline and owned by the Goal
  that creates them. Reuse inline Goal editing: Enter inserts a newline; blur,
  Escape and Ctrl/Meta+Enter finish and autosave, without a Save/Cancel bar.
  Discard new empty drafts; clearing an existing record does not implicitly
  delete it. Reveal edit/delete actions on hover or keyboard focus, keep access
  without hover, and hide them during editing. Use the existing note-style
  explicit delete action for the record, preserving source annotations. Retain
  text on save failure; show retry and dismissible feedback. The former Sidebar
  Collapsed variant now represents Empty content, with the add entry available.
  Scope, state references and prototype limitations:
  [interaction contract](../product/goals/user-input-response/interaction.md).

- On 2026-11-04 the owner requested a Git rollback of breadcrumb navigation.
  The current interface uses the original Home and Up one level controls, with
  the complete current Goal text, direct child Goals and linked materials in
  the existing content area. Creation and full-workspace actions retain their
  original behavior. The breadcrumb hover prototype is historical exploration,
  not the current implementation or an active design requirement. Parent
  previews and a last-reading Goal shortcut remain unimplemented proposals.
  See the [design status](design-index.md#goal-breadcrumbs-design).

- Indent child Goals, child drafts, and unified content together under the parent;
  root Goals stay unindented. Do not indent the material list again. The approved
  scheme 02 removes the spanning vertical guide and uses passive region icons
  and a horizontal divider without module-title text. Root navigation
  and creation tooltips describe their actual scope.
- The current Goal's neutral background covers its whole title/action row and
  stays stable during editing. Child-row hover/focus/open-menu feedback covers
  the whole row, including actions; disabled feedback dims the whole row.
- Show row edit/more/unlink actions on hover, keyboard focus, or while their menu
  is open; keep them visible without hover support. Overlay on the matching row
  surface without reserving text width or causing reflow. Hide while the textarea
  has focus. Edit and more occupy separate slots.
- Keep material type icons inside rows before their text, clear of the hierarchy
  guide; source labels align with material text. Omit counts and “linked items”
  headings. The existing separate Linked disclosure uses a links icon and an
  expansion caret. The approved MVP above supersedes that grouping requirement;
  it does not authorize changes to Highlight/Note Link components. The passive
  region icons do not collapse content in this implementation.
- In Home, the sidebar, and the full Goal workspace, show the saved source quote
  before the comment, distinguished with neutral styling and a vertical rule;
  no quote heading. Omit empty blocks and preserve source line breaks.
- Compact views independently limit quote and comment to three lines each;
  the full Goal workspace shows both without a limit. Preserve source jumps,
  unlinking, persistence, and existing material relationships.

## Existing Goal Editing

- Text clicks enter/select a Goal. Its explicit edit icon replaces that row's
  title in the same position without navigation or changing the parent's text,
  selected Goal, or linked materials. Every listed Goal has its own edit action.
- Keep edit/more positions stable; no separate editor below the row, input box,
  or focus frame. Default, hover, editing, and disabled states share text origin,
  usable width, typography, and minimum height. Let the editor grow with text.
- Use contextual Sidebar Root/Expanded typography and height overrides rather
  than unmodified base components. Full Goal rows retain their existing larger
  typography in every state.
- Terminal empty lines do not enlarge display or an unchanged editor. Preserve
  internal authored line breaks and the original stored value when opening and
  closing without edits; newly typed line breaks remain editable and grow input.
- Preserve existing save, blur, IME, and shortcut behavior. Reuse the same editor
  for current and listed Goals. New-Goal drafts retain their existing placement
  and rounded input treatment.

## Margin Note Editing

This exception applies to note cards, not Goal editors or all product inputs.

- Omit the separate source-location button while keeping Goal linking, deletion,
  source relationships, and other navigation actions.
- Edit inline without visible input box, border, shadow, or focus outline.
  The native textarea continues to own text, selection, and IME input.
- Enter finishes; Shift+Enter inserts a newline. Preserve Escape, Ctrl/Meta+Enter,
  blur completion, automatic saving, and composition handling. Goal shortcuts
  remain unchanged.
- Keep the custom caret fully opaque during its visible blink phase. Preserve
  height, positioning, blink timing, selection handling, and IME fallback.

## Scoped Presentation

These approved local measurements are retained because their scope and exceptions
matter. Use the corresponding [Figma instances and states](design-index.md#interface-states).
They are not global tokens; report conflicts rather than generalizing or discarding them.

| Scope | Approved presentation |
| --- | --- |
| Workbench actions | 40×40px icon targets, 12px corners, 20px SVG icons; text/context triggers 40px high with necessary label/title width; carets 16px. Dark neutral icons on transparent rest surface, light neutral hover/expanded/current-navigation feedback |
| Goal-row edit/more/unlink only | 28px targets, 8px corners, 16px icons; edit 36px and more 4px from row end. Goal navigation retains the workbench size |
| Parent contents / material disclosure | Group indent 16px; 4px before disclosure and between material list/rows. Disclosure 44×28px with 16px links icon and separate 12px caret |
| Sidebar Goal rows only | Root/current parent 16px Medium; child 14px Regular; 40px compact single-line rows, 10px horizontal text insets. Full Goal typography is unchanged |
| Reading toolbar | 52px reserved height; title width as specified in Workbench and Reading |
| Local Library | 300px popover, 8px padding, 38px header, 28px close target/16px icon, 36px book rows; maximum height 370px, constrained by viewport and content |
| Reading Settings controls | Unlabeled 40px swatches: #fafaf7, #f3ead7, #222321. Size readout uses interface font, 13px/1.4; font-menu rows retain Vega styling |
| Goal/menu alignment | 13px text, 1.4 line height, 8px vertical item padding (about 34.2px per row); compact separator/lower inset, about 123px for the ongoing three-item Goal menu |
| Margin-note custom caret only | Saturated red #dc2626, width 0.5ch; opacity and input behavior as specified above |

## Feedback and Product Copy

- Saving is automatic; omit a persistent Autosave label but retain pending/failed
  feedback and existing save/link triggers.
- Short ordinary success feedback appears near its action and fades. Errors stay
  clearly visible with dismissal. Preserve lifecycle Undo notices and avoid
  duplicate lifecycle-success notifications.
- Product UI, accessible labels, feedback, application-supplied desktop dialog
  text, and newly generated export descriptions use English. Preserve original
  book content/titles, reader-authored text, imported names, and historical values.
  Windows-owned controls follow the system language.
- Labels and generated filenames do not determine behavior: use stable identifiers
  or explicit document references. Keep Chinese source-book recognition supported.

## Open

Only details unresolved by explicit scoped approvals remain open:

- Frequency, grouping, and exact placement of actions outside the approved placements.
- Application-specific typography/layout not supplied by an explicit Figma design,
  scoped rule, or chosen component. Reuse supplied component values when available.
- Icon choices outside the specified workbench family.
- Motion, tooltip timing, and success-feedback duration.
- Dark appearance and narrow-window behavior.
- Detailed reading typography and paper appearance; approved settings-control
  colors do not settle document rendering.

Missing interface designs and extraction/font verification limits are recorded in
[design status](design-index.md#design-status). Do not infer new designs from other
screens. Preserve uncertain requirements as Open until confirmed.

## Decision Sources

[Workspace approval history](../product/decisions/2026-10-29-workspace-ui-decision.md)
records changes and rejected alternatives.
[Consolidation audit](../product/decisions/2026-11-04-ui-ux-consolidation.md)
records the disposition of the former separate specification, historical amendments,
and superseded rules. They supply provenance; this document owns current constraints.
