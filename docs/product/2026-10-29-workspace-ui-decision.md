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
