# Decision: shadcn/ui Vega, light appearance

Status: approved visual and interaction baseline. Detailed measurements and action
placement remain open below.
Source: the owner's UI/UX choices, explicit selection of Vega, and correction
that choosing shadcn/ui did not withdraw the approved rounded appearance.

## Decision

shadcn/ui is the primary, unified visual design system. Vega, the official classic
style, is the selected visual baseline. Prefer its components and use Vega's
coordinated geometry, spacing, typography, elevation, and component states.
Keep compatible existing presentation and confirmed preferences unchanged.
Where they conflict with Vega, Vega takes precedence. Do not replace compatible
controls merely to make every detail identical. Maia, Nova, Lyra, Mira, Luma,
and other systems are references, not selected styles.

This document owns the UI/UX baseline. The separate
[workspace decision](2026-10-29-workspace-ui-decision.md) records approved
workspace changes and their scope.

## Visual direction

- Use a light appearance with high contrast: light backgrounds, dark text, and
  dark icons. Essential content and control states must be easy to distinguish.
- Use black, white, and gray as the main palette. Blue is a small cue, not the
  main color of buttons and surfaces.
- Use a light gray application background and white content cards, following the
  existing regional separation. Use Vega's component borders and light elevation;
  do not require a card or shadow around every region.
- Keep compatible rounding. Use Vega's component geometry and shared radius
  scale where earlier shape requirements conflict. Do not force every button
  into a pill or circle, and do not remove rounding as a blanket rule.
- Keep compatible, comfortable spacing. Where earlier size or spacing demands
  conflict with Vega, use Vega's component sizes and spacing without extra
  enlargement or a substitute preset.
- The earlier Radix 105% preview is a reference for the preferred sense of size,
  not a requirement to scale the whole application by 105%.

## Layout and access

- Goal is an editable workspace with navigation, not a folder or an entry point.
  The sidebar and full Goal page use the same Goal state and editor.
- Reduce redundant controls and avoid adding steps. Preserve the existing layout
  outside the requested change.
- Common actions are directly visible. Other actions should be reachable by
  opening one menu. Which actions belong in each group is still open.
- Keep actions in familiar places and related to the content they act on. Confirm
  changes to primary interaction paths unless already explicitly authorized.

## Controls and states

- Prefer icon-only buttons with tooltips for familiar toolbar actions. Use labels
  when needed for clarity, following Vega's component examples. This does
  not authorize changing existing action placement or unrelated controls.
- Use the appropriate Vega button variant. Ghost actions have no persistent
  background and use the component's neutral hover treatment; primary, secondary,
  and destructive actions retain their distinct variants.
- Use Vega's selected, checked, active, focus, and disabled component states.
  Selection does not universally mean a dark solid background and white text.
- Opening a menu or panel is not an enabled toggle state. Its trigger stays
  unfilled or uses a light gray background while expanded; never use a dark
  solid fill merely because content is open.
- Follow Vega menu items: labels may stand alone; icons are optional where
  useful. Use checkbox or radio items for the corresponding choices, separators
  for groups, and destructive treatment for destructive actions. Show existing
  keyboard shortcuts on the right when available. Do not invent icons or
  shortcuts merely to fill a menu row.

### Workbench action buttons

- Reuse the existing Base UI Button and Vega's Ghost recipe, focus treatment,
  disabled state, and large icon-button size. This is a scoped refinement for
  the approved ChatGPT-like button reference, not a switch to another style.
- Icon action targets are 40 by 40 CSS pixels, with 12px rounded corners and
  20px SVG icons. Text/context triggers are 40px high with the same corners;
  keep their existing labels, book title, and necessary width. Carets are 16px.
- At rest use a transparent background and dark neutral icons. Hover and
  expanded/current navigation states use a light neutral background; no dark
  solid fill merely because a menu or panel is open. Keep disabled controls
  dimmed and keyboard focus visible.
- Use one SVG icon family for these actions. Reuse the installed Remix Icon
  paths, replacing text arrows, plus signs, and expansion glyphs. Keep action
  names available on hover and to assistive technology.
- Apply to Goal navigation and action icons, the sidebar control, book/library
  and contents triggers, reading settings, export, pagination, and the Settings
  entry. Reading-settings action controls share this treatment; font menu rows
  retain Vega menu styling. Preserve commands, IDs, values, and control placement.

### Margin note editing

- Do not show a separate source-location button on note cards. Keep Goal linking,
  deletion, and the existing source relationships and other navigation actions.
- Edit inline without a visible input box, border, shadow, or focus outline.
  Keep the native textarea responsible for text, selection, and IME input.
- Enter finishes editing; Shift+Enter inserts a newline. Preserve Escape,
  Ctrl/Meta+Enter, blur completion, automatic saving, and IME composition handling.
  Goal editor shortcuts are unchanged.
- The custom caret is saturated red (#dc2626), fully opaque during its visible
  blink phase, and 0.5ch wide, half its previous width. Keep its existing height,
  positioning, blink timing, selection handling, and IME fallback.

## Feedback

- Show short success feedback near the action, such as "Saved" or "Linked", then
  fade it out. Keep failures clearly visible.
- This describes feedback presentation. Existing save and linking triggers,
  data relationships, and error handling retain their meaning.
- Do not show a persistent "Autosave" label. Saving is automatic; keep pending
  and failed-save feedback without changing the save mechanism.

## Scope

- Apply this baseline within the current request. Approval of the baseline does
  not authorize a project-wide restyle or changes to untouched UI components.
- Preserve filtering, selection, editing, saving, and material relationships
  unless the user explicitly requests a behavior change.
- A preference, reference, or standalone mockup is not evidence that the product
  has been changed or verified.

## Implementation approach

- Prefer copying and reusing official Vega component code, theme tokens, and
  required styles over hand-writing approximations. Use the Base UI version
  compatible with the existing stack where available.
- Adapt existing actions and values to those components with the smallest
  necessary integration. Keep their keyboard, focus, and accessibility support.
- Reuse compatible existing components. Avoid parallel visual implementations,
  repeated CSS overrides, and custom variants without a concrete need.
- The current CSS and dependency setup records implementation facts, not a
  requirement to recreate Vega by hand. Integrate supporting styles and
  dependencies only as needed within an authorized implementation task.

## Alternatives reviewed

- The owner initially chose dark solid selection in a comparison. The later
  decision to follow shadcn/ui's component states supersedes that blanket rule.
- Radix Themes supplied early preferences for blue, full rounding, and a slightly
  larger scale. Later choices narrowed blue to a small cue and selected shadcn/ui
  Vega. Rounded preferences remain where compatible with Vega; Radix is not
  another UI system to mix into the product.
- Fluent 2, Spectrum, and other libraries were explored. No switch to those visual
  systems was approved.
- Vega is selected. The other shadcn styles are not interchangeable defaults.

## Open

- The frequency and grouping of actions, and their exact placement.
- Application-specific typography and layout measurements not supplied by the
  chosen components. Reuse Vega's supplied component measurements rather than
  leaving those values open for repeated custom design.
- Icon choices outside the workbench actions specified above.
- Motion, tooltip timing, and success-feedback duration.
- Dark appearance and behavior at narrow window sizes.
- Detailed treatment of reading typography and paper appearance.

## Evidence and limits

- The owner selected dark solid buttons in an independent control comparison.
  This records an earlier preference, superseded by the component-state decision
  below; it is not evidence of a completed application interface.
- For an implemented interface change, provide before-and-after screenshots,
  inspect the rendered result, and verify affected behavior. Report unverified
  items. No implementation or product validation is claimed by this document.

## Amendments

- Record later owner-approved decisions here and state which earlier rule they
  replace. Keep open items separate from approved rules.

### 2026-10-30: English product copy

- The owner approved unifying existing product copy in English before adding
  multilingual support. Include UI, accessible labels, feedback, application-supplied
  desktop dialog text, and newly generated export descriptions.
- For this copy-only change, preserve existing layout, positions, dimensions,
  spacing, typography, and interaction paths. Fit concise English copy into
  existing controls.
- Keep book content, original titles, reader-authored Goals and notes, imported
  names, and historical saved values in their original language.
- Display labels and generated filenames must not determine application behavior.
  Use stable identifiers or explicit document references. Chinese source-book
  content recognition remains supported.
- This replaces the mixed Chinese/English product copy convention. It does not
  introduce a language picker, translation framework, or data migration.

### 2026-10-30: Follow shadcn/ui component defaults

- The owner approved following shadcn/ui for differing component states and
  menu-item treatment. Selection is not universally dark; menu icons are optional.
- The earlier interpretation that this withdrew the rounded and comfortable
  appearance was rejected by the owner. It is corrected by the Vega amendment
  below. Do not use this historical amendment to remove rounded styling.
- References: [theming](https://ui.shadcn.com/docs/theming),
  [toggle](https://ui.shadcn.com/docs/components/base/toggle), and
  [dropdown menu](https://ui.shadcn.com/docs/components/base/dropdown-menu).

### 2026-10-30: Vega selected; rounded appearance retained

- The owner explicitly selected Vega, the classic shadcn/ui style. This replaces
  the earlier unspecified style and any interpretation of generic component
  defaults as the complete visual direction.
- Keep the confirmed light, neutral, high-contrast, rounded appearance, slight
  spacing preference, and light card shadows where compatible with Vega. The
  compatibility amendment below resolves conflicts; these preferences do not
  override Vega's geometry or density.
- Menus use Vega's item geometry, grouping, hover/focus, radio/checkbox indicators,
  and destructive treatment. Icons remain optional and action names remain clear.
- Preserve the rule that opening a menu or panel does not give its trigger a
  dark solid fill. Preserve Goal behavior, automatic saving, and the approved
  absence of a persistent Autosave label.
- This is a documentation decision, not evidence that the frontend matches Vega
  or authorization to restyle unrelated components.
- References: [official styles](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create),
  [theme and radius scale](https://ui.shadcn.com/docs/theming), and
  [rounded buttons](https://ui.shadcn.com/docs/components/base/button#rounded).

### 2026-10-30: Preserve compatible presentation; reuse Vega

- The owner confirmed: keep compatible presentation unchanged; use Vega for
  conflicts. This replaces the earlier absolute protection of existing corner
  sizes and spacing.
- Minimize follow-up work by reusing official Vega code and styles directly.
  Adapt existing bindings; do not build a separate visual approximation.
- This updates the contract only. Frontend changes remain scoped to their
  implementation request.
