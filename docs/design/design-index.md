# AuraReader Design Index

Verified: 2026-11-03 through Figma MCP `get_metadata`: all three pages, their
screen/component trees, the supplied node, and the Goal Sidebar set.
Names and node links below are verified navigation targets. This was a structural
inventory, not a new pixel audit, prototype-interaction review, or code verification.
Global principles and authority: [Design System](design-system.md).

## Figma Project

**Product UI Extraction — Goal & Reading**  
[Figma file](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=0-1) · file key: `eib6b1sDBsFa7hTzY2Zmsi`.

Purpose: reading workspace, its interaction states, Goal Sidebar, shared component
references, and documentation of styles extracted from the existing implementation.
No Figma file reorganization or design edits are part of this documentation task.

| Actual Figma Page | Node | Purpose / classification |
| --- | --- | --- |
| [01 - Screens](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=0-1) | `0:1` | Product interface and reading-state visual references |
| [02 - Components](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=3-2) | `3:2` | Component Reference; contextual instances may override base components |
| [03 - Foundations](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=3-3) | `3:3` | Existing Implementation Reference, including extraction documentation |

The task's supplied [15:348 link](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-348) targets the **Book Toolbar
instance inside Reading Interface / At rest**, not the entire reading screen.

## Product Interfaces

Design status describes design availability, not code completion. “Approved
Design” below identifies the product visuals supplied by the owner as the current
design basis; it is not a blanket approval of every extracted value or component.
The owner describes the main interface design as basically complete.

| Interface | Exact screen entry | Classification | Design status | Code implementation status |
| --- | --- | --- | --- | --- |
| Reading Interface | [Reading Interface](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-129) — Frame on 01 - Screens | Approved Design | Basically complete; states below | Not reverified in this task; see existing verification record |
| Goal Sidebar, within reading | [Goal Sidebar](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-2) — Instance on 01 - Screens; [embedded instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-130) | Approved Design; component/state references below | Design available | Not reverified in this task |
| Home | No frame found in this file | Planned design | **Planned / Not designed** — owner-confirmed identity, 2026-11-03 | Existing Home documented in [book module design](../archive/plans-and-implementation/goal-books-module-design.md); design absence does not mean missing code |
| Full Goal workspace | No frame found in this file | Existing Implementation / approved behavior documents | **Awaiting confirmation** of visual design coverage; not inferred from Sidebar | Shared editor/page documented in [cross-book plan](../archive/plans-and-implementation/goal-cross-book-sidebar-plan.md); not reverified |

Home is the unfinished independent interface identified by the owner. Full Goal
workspace is separately listed because the extraction excludes it; this inventory
does not declare it another planned redesign.

## Interface States

The following five frames represent **one Reading Interface**, not five product pages.

| Reading Interface state | Exact Frame | Context / related component |
| --- | --- | --- |
| Base reference | [Reading Interface](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-129) | [Book Toolbar instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-199) |
| At rest | [Reading Interface / At rest](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-278) | [Book Toolbar instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-348); reserved toolbar region |
| Reading settings open | [Reading Interface / Reading settings open](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-421) | [Reading Settings instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-542) |
| Local library open | [Reading Interface / Local library open](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-597) | [Local Library instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-718) |
| Contents open | [Reading Interface / Contents open](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-817) | [Contents Drawer instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-938) |

Goal Sidebar states live in [Goal Sidebar](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-581) on **02 - Components**.
These are sidebar/component states, not full Goal workspace screens.

| Exact variant name | Component node |
| --- | --- |
| State=Expanded | [14:241](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-241) |
| State=Collapsed | [14:316](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-316) |
| State=Root | [14:380](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-380) |
| State=Editing parent | [14:431](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-431) |
| State=Editing child | [14:506](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-506) |

“Collapsed” is the actual variant name; do not assume it means the entire
application sidebar is hidden. Read the relevant instance and existing command.
For Goal-row work, inspect these contextual variants alongside the base Goal Row:
approved root/parent typography and row-height overrides are recorded in
[Existing Goal editing](design-system.md#existing-goal-editing).

## Goal Breadcrumbs Design

Historical baseline: [Original Goal hierarchy-navigation requirements](goal-breadcrumbs-original-requirements.md).
On 2026-11-04 the owner requested a Git rollback to the original Home / Up one
level navigation. That interface is the current implementation. Breadcrumb
designs below are retained as historical exploration. This rollback does not
edit the remote Figma file.

| Resource on 02 - Components | Exact location | Scope |
| --- | --- | --- |
| Original Goal Sidebar | [14:581](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-581) | Current design reference: Home / Up, current Goal, children and materials |
| Historical compact review | [122:1756](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=122-1756) | Breadcrumb and sibling-hover exploration |
| Historical interactive prototype | [105:1769](https://www.figma.com/proto/eib6b1sDBsFa7hTzY2Zmsi?node-id=105-1769&starting-point-node-id=105%3A1769) | Superseded breadcrumb flow |
| Historical workspace foundation | [64:3500](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=64-3500) | Breadcrumb workspace variant |
| Historical sibling picker | [97:6051](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=97-6051) | Flat sibling-list exploration |

Current source: the original shared `goalUI.tsx` and `GoalController` selection
commands. The breadcrumb component and its dedicated regression were removed
by the rollback. The original requirements and verification record remain
available for history; they do not prescribe current navigation behavior.

## Shared Components

All entries below are on **02 - Components** and classified **Component Reference**.
A grouping Frame contains the named component variants; a single-component link
targets that component. Availability does not certify approval or implementation
of every variant. Apply explicit product instances and approved scoped decisions.
The task's “Action Buttons” corresponds to the actual singular **Action Button**.

The last column is an existing source navigation aid, not a claim of a registered
Code Connect binding or identical code/design state.

| Actual design entry | Available states / context | Existing source reference |
| --- | --- | --- |
| [Action Button](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=4-111) | Size=40 / Size=28 × Default, Hover, Expanded, Focus, Disabled | [components/ui/button.tsx](../../src/client/components/ui/button.tsx) |
| [Goal Row](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=4-152) | Parent / Child × Default, Hover, Editing, Disabled; see Sidebar instances for overrides | [features/goals/goalUI.tsx](../../src/client/features/goals/goalUI.tsx) |
| [Linked Material Disclosure](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=4-174) | Expanded, Collapsed, Hover | [features/goals/goalUI.tsx](../../src/client/features/goals/goalUI.tsx) |
| [Linked Material](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-172) | Filled, Hover, Loading, Unavailable | [features/goals/GoalMaterialText.tsx](../../src/client/features/goals/GoalMaterialText.tsx) |
| [New Goal Draft](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=4-181) | Default, Focus, Disabled | [features/goals/goalUI.tsx](../../src/client/features/goals/goalUI.tsx) |
| [Menu Item](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=4-188) | Default, Highlighted, Destructive | [features/goals/goalActions.tsx](../../src/client/features/goals/goalActions.tsx) |
| [Text Action](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-146) | Default, Hover, Selected, Outline, Disabled | [features/workbench/WorkbenchShell.tsx](../../src/client/features/workbench/WorkbenchShell.tsx) |
| [Pagination](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-189) | Middle, Start, End | [features/workbench/WorkbenchShell.tsx](../../src/client/features/workbench/WorkbenchShell.tsx) |
| [Book Toolbar](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-274) | [Rest](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-190), [Visible](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-232); use screen state for context | [features/workbench/WorkbenchShell.tsx](../../src/client/features/workbench/WorkbenchShell.tsx) |
| [Reading Settings](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-275) | Panel; [in-screen instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-542) | [features/workbench/WorkbenchShell.tsx](../../src/client/features/workbench/WorkbenchShell.tsx) |
| [Font Menu](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-324) | Font groups and selected/disabled entries | [features/reader/fontPickerUI.tsx](../../src/client/features/reader/fontPickerUI.tsx) |
| [Book Row](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=7-343) | Book entry | [features/shelf/shelfUI.tsx](../../src/client/features/shelf/shelfUI.tsx) |
| [Local Library](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-253) | Popover; [in-screen instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-718) | [features/shelf/shelfUI.tsx](../../src/client/features/shelf/shelfUI.tsx) |
| [Contents Row](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-199) | Root, Child, Active | [features/reader/tocUI.js](../../src/client/features/reader/tocUI.js) |
| [Contents Drawer](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-200) | Drawer; [in-screen instance](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=15-938) | [features/reader/tocUI.js](../../src/client/features/reader/tocUI.js) |
| [Goal Action Menu](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-189) | [Ongoing](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-173), [Completed](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-181) | [features/goals/goalActions.tsx](../../src/client/features/goals/goalActions.tsx) |
| [Margin Note](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-371) | Note, Focused, Editing, Highlight, Linked, Disabled | [features/workbench/ReadingWorkbench.tsx](../../src/client/features/workbench/ReadingWorkbench.tsx) |
| [Selection Actions](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=13-372) | Selection toolbar | [features/workbench/ReadingWorkbench.tsx](../../src/client/features/workbench/ReadingWorkbench.tsx) |
| [Goal Sidebar](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-581) | Expanded, Collapsed, Root, Editing parent, Editing child; links below | [features/goals/goalUI.tsx](../../src/client/features/goals/goalUI.tsx) |
| [Workspace Brand Header](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-224) | Shared header | [features/workbench/WorkbenchShell.tsx](../../src/client/features/workbench/WorkbenchShell.tsx) |
| [Workspace Settings Entry](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-236) | Shared Settings entry | [features/workbench/WorkbenchShell.tsx](../../src/client/features/workbench/WorkbenchShell.tsx) |
| [Reader Paper / current column](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=14-582) | Current visible reading column specimen | [features/reader/readerRuntime.ts](../../src/client/features/reader/readerRuntime.ts) |
| [Icon/links and Icon/*](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=4-2) | 23 icon components on [02 - Components](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=3-2) | [components/ui/action-icon.tsx](../../src/client/components/ui/action-icon.tsx) |

Variant names above follow MCP metadata, supplemented by the extraction's inventory
for nested menu content. Precise state nodes are reachable from each linked group;
do not create absent state designs or equate a specimen with executable behavior.

## Foundations & References

All Figma entries in this section are **Existing Implementation Reference**.
These are extraction records, not newly approved global palettes or token scales.

| Resource on 03 - Foundations | Exact location | Use / limit |
| --- | --- | --- |
| Foundations / Implemented source styles | [5:2](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=5-2) | Parent extraction frame |
| Colors | [5:5](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=5-5) | Extracted CSS colors and aliases |
| Typography | [5:70](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=5-70) | Extracted type specimens; font equivalence caveat below |
| Spacing | [5:97](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=5-97) | Existing CSS lengths, not a newly approved spacing scale |
| Radius | [5:132](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=5-132) | Implemented corners, not universal radius rules |
| Shadows | [5:143](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=5-143) | Extracted effect specimens |
| Component Inventory | [04 - Documentation](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=16-982) | Section within one documentation text block |
| Code-to-Figma Mapping | [04 - Documentation](https://www.figma.com/design/eib6b1sDBsFa7hTzY2Zmsi?node-id=16-982) | Section in the same Frame; no separate section node exists in this inventory |

**04 - Documentation is a Frame on 03 - Foundations, not a fourth Page.**
Its text includes extraction scope, component/source mapping, token inventory,
font exceptions, and QA limits. The historical source-authority statement there
describes extraction provenance; current responsibilities follow
[Design Authority](design-system.md#design-authority).

| Project reference | Purpose |
| --- | --- |
| [Design System](design-system.md) | Current global and scoped UI/UX constraints, copy, and Open items |
| [Decision records](../product/decisions/README.md) | Approved changes, scope, and historical reasons |
| [Existing Figma implementation verification](../archive/verification/figma-ui-verification-2026-11-03.md) | Historical implementation checks and corrections; not new verification |
| [Project profile](../agents/project-profile.md) | Current stack, code locations, commands, behavior-document entry points |
| [Historical Goal prototype](../prototypes/goals.html) | Earlier scoped reference; later approved decisions supersede earlier details, not a missing Home design |

## Design Status

| Status | Meaning here |
| --- | --- |
| Basically complete / design available | Owner-supplied product visuals and verified nodes exist; remaining unspecified details are not silently filled in |
| In progress | No individual frame verified as carrying this status; do not assign it from code progress |
| Planned / Not designed | Home: owner-confirmed unfinished independent interface, no matching frame |
| Awaiting confirmation | Full Goal workspace visual coverage and missing details; no invented link |
| Exploration | No node identified as exploration in this inventory; historical experiments do not become approved designs by inclusion |

Remaining gaps and limits:

- Home has no design frame. Do not extrapolate its design from the reading screen.
  Full Goal workspace also has no frame in this file; its visual-design status needs
  confirmation while its approved behavior remains in force.
- The extraction records temporary Noto Sans SC substitution for unavailable Sarasa
  Gothic SC, wrapping/truncation differences, and incomplete final MCP QA.
  Exact font equivalence is not established by this index.
- The captured viewport and saved sidebar width are instance/source configuration,
  not new defaults or product tokens. Component base geometry can differ from
  contextual Sidebar overrides; use the approved instance and scoped decision.
- Dark appearance, narrow-window behavior, motion/timing, and detailed reading
  typography/paper questions remain governed by [Open](design-system.md#open)
  unless a specific approved design resolves the exact detail.
- No code completion, current build health, or exhaustive visual/state approval is
  inferred from design availability. Recheck the relevant Figma design when starting
  implementation; retain behavior and validation requirements in [AGENTS.md](../../AGENTS.md).

Maintain this index as navigation and status. Keep current global and scoped constraints in the
[Design System](design-system.md), and approval/change history in
[decision records](../product/decisions/README.md).
