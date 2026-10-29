# Workspace UI decision

date: 2026-10-29 · source: explicit owner confirmation

## Approved changes
- Reorganize the top bar.
- Remove the EPUB enlargement entry.

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
- The two changes above are approved. Their detailed implementation is not
  otherwise specified by this record.
- Other changes made during the earlier implementation are not approved by
  inclusion in the current code.
- This record covers the approved workspace changes. The shared visual and
  interaction rules are owned by [the UI/UX baseline](ui-ux-design.md).

## Amendments
- Record later owner-approved changes here, identifying which earlier rule they
  replace. Preserve the reason for a rejected option when the owner provides it.
