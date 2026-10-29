# Decision: shadcn/ui, light appearance

Status: approved visual and interaction baseline. Detailed measurements and action
placement remain open below.
Source: the owner's choices in the UI/UX discussion, including the explicit choice
of shadcn/ui and the comparison of selected button states.

## Decision

shadcn/ui is the primary, unified visual design system. Use it consistently and
prefer its components. Other systems explored in the discussion are references,
not additional visual directions.

This document owns the UI/UX baseline. The separate
[workspace decision](2026-10-29-workspace-ui-decision.md) records the approved top
bar reorganization and removal of the EPUB enlargement entry.

## Visual direction

- Use a light appearance with high contrast: light backgrounds, dark text, and
  dark icons. Essential content and control states must be easy to distinguish.
- Use black, white, and gray as the main palette. Blue is a small cue, not the
  main color of buttons and surfaces.
- Use a light gray application background and white content cards, following the
  existing regional separation. Give cards a light shadow for depth.
- Keep controls rounded: text buttons approach a pill shape; icon buttons approach
  a circle. This does not prescribe the same radius for every surface.
- Keep the interface slightly spacious. Buttons should be easy to target, with
  comfortable space between text, controls, and content.
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

- Toolbars use icon-only buttons. Hover shows the action's name.
- At rest, an icon button shows a dark icon without a persistent background.
- On hover, it gets a light gray circular background.
- Selected or enabled toggle states use a dark solid background and a white icon.
  This is the owner's chosen alternative from the standalone comparison.
- Expanded menus show a small icon and the action's name. Show existing keyboard
  shortcuts on the right when available.

## Feedback

- Show short success feedback near the action, such as "Saved" or "Linked", then
  fade it out. Keep failures clearly visible.
- This describes feedback presentation. Existing save and linking triggers,
  data relationships, and error handling retain their meaning.

## Scope

- Apply this baseline within the current request. Approval of the baseline does
  not authorize a project-wide restyle or changes to untouched UI components.
- Preserve filtering, selection, editing, saving, and material relationships
  unless the user explicitly requests a behavior change.
- A preference, reference, or standalone mockup is not evidence that the product
  has been changed or verified.

## Alternatives reviewed

- Light outlined selection was compared with dark solid selection. The owner
  chose dark solid; keep that as the baseline.
- Radix Themes supplied early preferences for blue, full rounding, and a slightly
  larger scale. Later choices narrowed blue to a small cue and made shadcn/ui the
  unified visual direction.
- Fluent 2, Spectrum, and other libraries were explored. No switch to those visual
  systems was approved.
- No specific shadcn style preset, such as Maia or Luma, has been chosen.

## Open

- The frequency and grouping of actions, and their exact placement.
- Typography, spacing, control sizes, surface radii, and shadow values.
- Icon library and the icons used for individual actions.
- Motion, tooltip timing, and success-feedback duration.
- Dark appearance and behavior at narrow window sizes.
- Detailed treatment of reading typography and paper appearance.

## Evidence and limits

- The owner selected dark solid buttons in an independent control comparison.
  It demonstrates that preference, not the completed application interface.
- For an implemented interface change, provide before-and-after screenshots,
  inspect the rendered result, and verify affected behavior. Report unverified
  items. No implementation or product validation is claimed by this document.

## Amendments

- Record later owner-approved decisions here and state which earlier rule they
  replace. Keep open items separate from approved rules.
