# AuraReader agent contract

## Purpose and precedence
- The user's current request comes first, then this file, then the documents it
  points to. Skills and default workflows must fit the request.

## Authority
- Inspect, research, review, and plan requests are read-only. Discussing a draft
  does not authorize writing it to the project.
- Change requests authorize scoped local edits, necessary non-destructive
  validation, and local commits. Preserve unrelated work already in the checkout.
- Pushing, publishing, deploying, destructive operations, and writing to external
  systems need explicit approval.

## Code boundaries
- React owns the surrounding interface; the reader owns the document subtree.
  Keep DOM and Range objects inside the reader boundary.
- Reuse the existing commands, controllers, and repositories when changing the
  interface. Moving a control keeps its existing action and meaning.
- A visual prototype supplies presentation only. Its example data and interaction
  shortcuts do not replace the application's behavior.
- For interface work, preserve filtering, selection, editing, saving, and material
  relationships. Confirm changes to product behavior or primary interaction paths
  unless the user has already explicitly authorized them.

## Interface scope
- Before UI/UX work, read docs/design/design-system.md and
  docs/design/design-index.md, then locate the relevant Figma frame and states.
- Resolve unspecified details from existing rules and components within the
  requested scope. Report ambiguity when those sources and Figma give no basis
  or conflict; do not invent global visual rules. Never change visual details
  of existing UI components outside that scope.
- Nearby fixes are allowed when directly related, clearly understood, small, and
  introduce no new product rule. This does not expand the permitted visual scope.
  Report every such fix and its reason.
- Separate features, filtering policies, and data relationship changes are
  suggestions for another task. Fix defects caused by the current change.

## Workflow and artifacts
- Read docs/agents/project-profile.md before choosing commands, artifact
  locations, or project terminology.
- For approval history, consult applicable records listed in the profile.
  Existing implementation is not evidence that a disputed design was approved.
- Update the relevant document when a task changes a recorded project fact or an
  approved design. Keep decisions out of conversation-only history.
- For prototypes, retain the original when asked to make a copy.

## Validation
- Run the profile's validation baseline before reporting a change complete.
- Report checks that were not run and evidence that could not be obtained.
- Report the requested changes and each nearby fix separately. Passing tests does
  not expand the authorized scope.
- Source changes and local validation do not establish that a new package was
  built, installed, or published. Report the artifact actually verified.

## Conventions
- New agent rules and project profiles: English.
- Owner-facing explanations, questions, and summaries: Chinese.
- Existing product documents retain their language unless translation is requested.

## Maintenance
- Keep this file for durable rules. Project facts belong in the profile;
  progress and validation belong elsewhere.
- Preserve records still serving as behavior sources or evidence for unresolved checks.
- A recurring failure becomes a proposed minimal rule. Add it here after the user
  confirms it.
