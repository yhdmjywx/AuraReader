# UI/UX Documentation Consolidation

Date: 2026-11-04. Authority: the owner's audit request and explicit instruction to
replace the separate UI/UX specification with the Design System.
This reorganizes existing approvals; it introduces no product or visual decision.

## Current ownership

- [Design System](../../design/design-system.md): the single current UI/UX
  specification, including global principles, scoped exceptions, interaction
  constraints, and Open questions.
- [Design index](../../design/design-index.md): Figma navigation, state coverage,
  source navigation, and design status.
- [Decision records](README.md): approval history, changes, and necessary reasons.
- [AGENTS.md](../../../AGENTS.md) and the
  [profile](../../agents/project-profile.md#validation-baseline): task scope,
  code boundaries, permissions, commands, and validation.

The former separate UI/UX file is removed after its effective rules are incorporated
in the Design System. The former workspace record is preserved in this directory.
Existing verification records remain evidence of their dated checks.

## Approval history retained from the former specification

| Source date / subject | Approval or reason | Later status / current location |
| --- | --- | --- |
| Earlier control comparison | The owner chose dark solid buttons in an independent comparison; this was not a completed product interface | Blanket dark selection was superseded by component-specific states |
| Earlier Radix Themes preview | Blue, full rounding, and a slightly larger 105% preview informed initial preferences | Later approvals limited blue to a small cue and selected Vega; 105% was a reference, not application-wide scaling |
| 2026-10-30 component defaults | Follow shadcn component states and menu treatment; icons may be omitted | Interpreting this as withdrawal of rounding was rejected |
| 2026-10-30 Vega selection | Vega classic was explicitly selected; retain compatible rounded, comfortable presentation | No blanket removal of rounding; other shadcn styles are not interchangeable defaults |
| 2026-10-30 compatibility and reuse | Preserve compatible presentation; use official Vega code/styles rather than a separate approximation | Later Figma-first authority limits Vega to unspecified details; no project-wide restyle authorized |
| Alternatives | Fluent 2, Spectrum, and other libraries were explored; no switch was approved | Historical references only |
| 2026-10-30 English copy | Unify UI, accessible labels, feedback, app-supplied desktop dialog text, and new export descriptions in English | Copy-only change preserved layout, dimensions, typography, and paths. It introduced no picker, translation framework, or data migration; current copy contract is in the Design System |
| 2026-10-30 workbench/Goal/note refinements | Shared action treatment, compact row actions, stable inline editing, material ownership, and note-caret repair | Current scoped constraints are consolidated in the Design System; approval sequence is preserved in the workspace record |
| 2026-11-03 reading navigation | Quote before comment; one pagination instance in the existing toolbar; stable hover disclosure; title width limit | Replaces bottom pagination and the rejected additional-row interpretation |
| 2026-11-03 Figma alignment | Approved alignment covered Local Library, Reading Settings, Menu Item, Goal Row, and Book Toolbar including at rest | The former supplied link targets a toolbar instance, not a complete screen. Use the verified design index |
| 2026-11-03 contextual Goal rows | Root/parent Sidebar instances override the base component's typography/height; full Goal typography remains distinct | Keep state metrics stable and use contextual instances; extraction-base geometry is not a replacement |
| 2026-11-03 visual/behavior split | Explicit Figma visuals govern appearance; existing code retains real behavior | Foundations and extraction source-authority notes do not establish new approved global tokens |

The former Evidence section's implementation-validation instructions are already
owned by the current agent contract/profile. No new build, interface verification,
or completed implementation is established by these design approvals.

## Audit disposition

The full former specification and workspace approval record were read before edits.
Keep / Move / Remove / Open below describe document treatment, not new approval.

| Former content | Disposition | Destination / reason |
| --- | --- | --- |
| Decision / visual direction | Move; remove duplicate execution text | Design System: authority, visual direction, and Vega foundation |
| Layout and access / Scope | Keep effective constraints; remove duplicates | Product invariants and task boundaries remain in AGENTS; UI-specific principles in Design System |
| Generic controls and states | Move; deduplicate | Design System Component Principles; preserve icon-only preference and distinct expanded/toggle semantics |
| Workbench action buttons | Keep, scoped | Design System workbench rules and scoped presentation table; retain compact Goal-row exception |
| Goal hierarchy and material disclosure | Keep, scoped | Design System Goal section; group indentation, whole-row feedback, material-icon placement, and identifying disclosure |
| Existing Goal editing | Keep | Design System: independent row editing, state metrics, terminal-line/store preservation, native input, and existing shortcuts |
| Margin note editing | Keep, scoped | Design System: editor chrome exception, note-only shortcuts, native input, and custom caret |
| Source text / reading navigation | Keep | Design System: source/comment order and independent previews, one toolbar, hover/focus/panel access, full-title preservation |
| Dated Figma alignment section | Split Keep / Move | Behavior and scoped measurements in Design System; exact visual navigation already in design index; approval context retained above |
| Feedback | Keep; deduplicate | Design System: automatic saving, transient success, persistent errors, and lifecycle Undo |
| Implementation approach | Move; deduplicate | Design System Design Foundation; no separate CSS/dependency migration directive |
| Alternatives / historical Amendments | Move | Approval history above and preserved workspace record; no chronological checklist in the current specification |
| English-copy amendment | Split Keep / Move | Current copy and stable-identifier rules in Design System; one-off copy-only implementation boundary retained above |
| Open | Keep | Design System Open; missing Figma coverage remains in design index |
| Evidence and limits | Move / remove duplicate | Approval provenance above; validation in AGENTS/profile |
| Workspace-only active details | Keep | Sidebar control location, separate full-Goal navigation, font radio choices, Undo/error treatment, rounded new drafts, and EPUB-entry removal are retained in the Design System |
| Superseded wording | Remove from current execution rules | Universal dark selection, mandatory reserved action width, old action sizing, left-gutter icons/counts, extra pagination rows, 105% scaling interpretation, and older Vega precedence are not current rules |

Unspecified details remain Open. Figma availability alone was not used to delete a
behavioral constraint or discard an approved local measurement. No fresh Figma
pixel audit was required or claimed; the existing verified index remains the
navigation source. Historical file references were updated without changing their
recorded implementation or test outcomes.
