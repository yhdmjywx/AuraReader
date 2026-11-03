# Workspace UI decision

date: 2026-10-29 · source: explicit owner confirmation

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
- Follow the approved [UI/UX baseline](ui-ux-design.md); its Open section records
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
  interaction rules are owned by [the UI/UX baseline](ui-ux-design.md).

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
- Follow the Vega decision in [the UI/UX baseline](ui-ux-design.md). It owns the
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
