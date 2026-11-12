# Workspace UI decision

date: 2026-10-29 · source: explicit owner confirmation

Current global visual authority is defined by the
[design system](../../design/design-system.md); use the
[design index](../../design/design-index.md) to locate explicit Figma designs.
Historical Vega-priority wording here applies to unspecified details, not over
explicit Figma visuals. The approved local decisions below retain their scope.

## Record status

Migrated on 2026-11-04 from the former product-level workspace decision file.
The dated approval text below is retained as historical evidence; only relative
link destinations have been updated. Use the [Design System](../../design/design-system.md)
for current constraints and the [design index](../../design/design-index.md) for Figma.
Do not implement superseded wording from this record.

| Earlier wording | Later approval / current owner |
| --- | --- |
| Reserve width for hidden Goal-row actions | “Goal content alignment and usable text width” below replaced it with overlays |
| Earlier 40px Goal-row actions | “Quiet, compact Goal row actions” below introduced the compact exception |
| Left-gutter material icons; count or caret-only disclosure | “Material-row correction” below replaced these rejected treatments |
| Bottom pagination or an additional toolbar row | 2026-11-03 reading-navigation amendment below fixes one instance in the existing toolbar |
| Blanket Vega priority | The current Design System applies explicit Figma visuals first |
| Before-and-after screenshots | Current [agent validation](../../../AGENTS.md#validation) and [profile](../../agents/project-profile.md#validation-baseline) supersede this requirement |
| Shared visual rules owned by a separate UI/UX baseline | The owner consolidated current rules into the Design System on 2026-11-04 |

## Original approval record

## Approved changes
- Reorganize the top bar.
- Remove the EPUB enlargement entry.
- Keep the reading settings trigger icon-only and restyle the controls inside its
  panel to the approved UI/UX baseline. Retain existing setting values, actions,
  event bindings, and preference behavior.

## Constraints
- Goal remains an editable workspace with navigation. The sidebar and full Goal
  page use the same Goal state and editor.
- Reduce redundancy and avoid adding steps.
- Reuse existing actions. Preserve filtering, selection, editing, saving, and
  material relationships unless a behavior change is explicitly authorized.
- Follow the approved [UI/UX baseline](../../design/design-system.md); its Open section records
  unresolved details.
- Decide unspecified visual details only within the requested change. Never
  change visual details of existing UI components outside that scope.
- Confirm decisions affecting product behavior or primary interaction paths
  unless already explicitly authorized.
- Provide before-and-after screenshots for every interface change, inspect the
  rendered result, and verify the affected behavior.

## Approval boundary
- The changes above are approved. Their detailed implementation is not
  otherwise specified by this record.
- Other changes made during the earlier implementation are not approved by
  inclusion in the current code.
- This record covers the approved workspace changes. The shared visual and
  interaction rules are owned by [the UI/UX baseline](../../design/design-system.md).

## Amendments
- Record later owner-approved changes here, identifying which earlier rule they
  replace. Preserve the reason for a rejected option when the owner provides it.

### 2026-11-03: Linked quotes and top reading navigation
- Show a linked note's saved source quote before its comment, without a quote
  heading, across Home and the shared sidebar/full Goal view. Keep material
  relationships and source actions unchanged.
- Move pagination from the bottom into the existing reading toolbar, in the same
  row as the book title and actions. The owner clarified that no additional row
  or bar is allowed; this replaces the initial separate-row interpretation.
  Keep the toolbar height and existing actions; remove the bottom instance.
- The owner subsequently approved simple hover disclosure for this toolbar:
  show on top-area hover and hide on leave, preserving its appearance and space.
  Keep keyboard and open-panel access. No other interface changes are in scope.
- Limit the top book title to 18ch with single-line ellipsis and allow further
  shrinkage. Retain the full title in data, accessible text and a hover title.
- These approved changes override earlier placement/width-preservation rules
  for these controls only. Details are owned by the UI/UX baseline.

### 2026-10-30: Goal controls and automatic saving
- Keep the Goal sidebar control in the left brand/Goal area, with the same
  control available on the left when the sidebar is closed. It does not belong
  to the book toolbar. Opening the full Goal page remains a separate action.
- A single click on a Goal selects or enters it, including the current Goal
  title. Use an explicit edit icon beside the current Goal to start the existing
  editor; clicking its title no longer changes meaning after selection.
- Menu and panel triggers do not use a solid fill merely because they are
  expanded. Actual choices and toggles follow their shadcn/ui component states,
  as specified in the updated UI/UX baseline; solid selection is not universal.
- Remove the persistent Autosave label. Preserve automatic saving, pending-save
  feedback, and errors. This changes presentation only.

### 2026-10-30: Reading workbench component alignment
- Use neutral workbench actions and badges, keeping the brand color. Use Vega's
  component geometry where existing presentation conflicts; keep compatible
  rounded styling. Blanket removal of rounding was rejected by the owner.
  Keep control placement and setting values.
- Present font choices as radio menu items with a selection indicator. Use
  neutral active treatment for paper and layout choices, not a universal black
  selected fill. These changes affect controls, not document rendering.
- Give Goal icon actions hover names. Plain-text Goal menu items remain valid.
- Show ordinary success feedback near its action and let it disappear. Mark
  errors explicitly and keep them visible with a dismiss action. Keep lifecycle
  Undo notices available and remove duplicate lifecycle success notifications.
- Preserve the existing persistence, commands, filtering, and relationships.

### 2026-10-30: Vega visual baseline
- Follow the Vega decision in [the UI/UX baseline](../../design/design-system.md). It owns the
  selected style, compatibility rule, direct-code-reuse approach, and menu
  presentation. Preserve compatible presentation; use Vega for conflicts.
  Earlier component-alignment text is not an independent shape or spacing rule.
  This amendment updates documentation only.

### 2026-10-30: Workbench action buttons
- The owner approved a shared button standard and implementation for workbench
  actions, book selection, and reading settings. Use Vega Ghost behavior with
  40px targets, 12px corners, and 20px SVG icons, as specified in the UI/UX baseline.
- Preserve the current horizontal/vertical layout, action bindings, book-title
  context, menus, and preferences. Reuse the Base UI primitive and installed
  icons; no new dependency or whole-project component migration is required.

### 2026-10-30: Margin note repair
- Remove the note-card source-location button and visible input-box chrome.
  Enter finishes; Shift+Enter inserts a newline. Preserve the other existing
  edit, save, IME, Goal-link, delete, and navigation behavior.
- Use a fully opaque saturated-red caret at half its former width. The detailed
  presentation and shortcut contract is in the UI/UX baseline.

### 2026-10-30: Stable inline Goal editing
- Existing Goal editing replaces its title in place, within the title row.
  Keep edit/more buttons stationary and omit input-box chrome. Preserve text
  metrics, save behavior, shortcuts, and new-Goal draft placement.

### 2026-10-30: Goal workspace presentation
- Goal supports editing the reader's intent, navigating child Goals, and viewing
  explicitly linked materials. Keep the existing hierarchy, entry points, and
  shared sidebar/full-page controller and editor.
- Keep parent contents indented together. Mark the current Goal with a neutral
  background that stays stable during editing. Root navigation and creation
  tooltips describe their actual scope.
- Reuse Vega Ghost controls for the material disclosure, SVG material icons,
  neutral states, and aligned rows. New drafts use the existing rounded input
  treatment; existing Goal editing remains inline without input-box chrome.
- Preserve selection, filtering, save shortcuts, material links, source jumps,
  unlinking, and lifecycle menus. No new product behavior is introduced.

### 2026-10-30: Direct child editing and visible ownership
- The owner rejected the weak parent/content distinction and editing available
  only after entering a Goal. Add a visible edit action to each listed Goal;
  editing replaces that row's text without changing the active Goal or materials.
- Keep the current parent's text and actions visible. Use a vertical guide
  beside the existing indented contents. The owner rejected the added current/
  child section labels; remove them and express ownership without extra labels.
- This explicitly extends the editing entry points. Preserve text-click
  navigation, existing save/IME/shortcut behavior, hierarchy, and relationships.

### 2026-10-30: Quiet, compact Goal row actions
- Following the owner's ChatGPT reference, hide row edit/more/unlink actions at
  rest and show them on row hover or keyboard focus; keep open-menu actions
  visible. Use 28px controls with 16px icons, replacing their 40px sizing.
- Reserve action space to avoid text reflow. Keep actions visible without hover
  support, preserve disabled behavior, and retain navigation sizes and commands.

### 2026-10-30: Goal background hierarchy correction
- Extend the current Goal's selected background across the whole title/action
  row. Do not stop the background before the reserved action area.
- Remove the linked-material disclosure's persistent expanded background;
  retain neutral hover/focus feedback. This overrides expanded Ghost background
  treatment for this disclosure only. Keep dimensions and behavior unchanged.

### 2026-10-30: Goal content alignment and usable text width
- Reduce the stacked gaps around the material disclosure and list. The later
  material-row correction supersedes the rejected left-gutter icon placement.
- The owner approved removing hidden actions' reserved width. Overlay compact
  actions at the row end with a matching surface, without reflowing text.
  Hide overlays while typing to keep input unobscured. This replaces the earlier
  reserved-space rule; keep keyboard access and command behavior.

### 2026-10-30: Material-row correction
- The owner rejected icons crossing the hierarchy guide and the visible
  "linked items" count/heading. Keep type icons inside material rows before
  their text. Source labels align with the material text.
- Remove the visible count and heading. Retain the existing material disclosure
  as a compact icon-only control with hover/accessibility names, preserving its
  expand/collapse behavior and all source/link actions.
- Correction: include a links icon to identify the linked-material function;
  keep a smaller caret for expansion state. The owner rejected the caret-only
  replacement. The combined icon control is 44px wide and 28px high.

### 2026-11-04: Goal Breadcrumbs and separate root/tree actions
- The owner approved the Breadcrumbs review `66:1947`, prototype `66:2473`, and
  component family `64:3500` as the basis for implementation planning.
- The owner subsequently approved splitting the Goals entry into two targets:
  Goals text returns to the root level using the former Home action; the adjacent
  downward arrow opens the complete hierarchy without changing the current Goal.
  Do not add a redundant Goals root item inside the picker.
- The Figma update includes root-context tree states and a focused review at
  `75:2619`. The original Goal Sidebar `14:581` is retained. This approval records
  design behavior; it does not establish source implementation or package delivery.

### 2026-11-04: Direct text navigation and clickable hover selectors
- The owner requested adapting the existing Figma design to the discussed
  mouse/touch scheme: click named path text to enter; hover to open an operable
  selector. The owner explicitly clarified that hover-open structure must be
  clickable. Keyboard behavior is outside this revision.
- Retain adjacent downward-arrow click targets to pin the same selector. Pointer
  movement into the popup must not close it; pinned popups do not close on exit.
  Ellipsis remains a selector entry rather than a direct Goal destination.
- The review is at `80:5049`, pointer-state family at `79:5114`, and the existing
  prototype `66:2473` uses the new interaction family. Scoped initial timings are
  300ms to open and 200ms to close on exit. Application implementation is pending.
