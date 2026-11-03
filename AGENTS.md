# AuraReader agent contract

## Purpose and precedence
- AuraReader is a reader centered on the reader's goals. It supports the reader
  acting toward those goals; the reader remains the subject. Goals can exist
  independently, change, branch, and end. EPUB and other formats serve this purpose.
- The user's current request comes first, then this file, then the documents it
  points to. Skills and default workflows must fit the request.

## Authority
- Inspect, research, review, and plan requests are read-only. Discussing a draft
  does not authorize writing it to the project.
- Change requests authorize scoped local edits, necessary non-destructive
  validation, and local commits. Preserve unrelated work already in the checkout.
- Pushing, publishing, deploying, destructive operations, and writing to external
  systems need explicit approval.

## Product invariants
- Goal is the core of the product. It is an editable workspace with navigation,
  not just a folder or an entry point.
- The sidebar and full Goal page use the same Goal state and editor.
- Goals exist independently of books. Readers may also read and annotate without
  setting a Goal.
- Opening a book, adding a book to a Goal, and linking material are separate
  actions. The system does not infer these relationships.
- Interface changes reduce redundancy and avoid adding steps.

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
- The approved UI/UX baseline is docs/product/ui-ux-design.md. Read it before
  interface work and follow its confirmed rules; unresolved details are listed
  under Open. shadcn/ui is the chosen visual design system.
- Decide unspecified visual details within the requested change. Never change
  visual details of existing UI components outside that scope.
- Nearby fixes are allowed when directly related, clearly understood, small, and
  introduce no new product rule. This does not expand the permitted visual scope.
  Report every such fix and its reason.
- Separate features, filtering policies, and data relationship changes are
  suggestions for another task. Fix defects caused by the current change.

## Workflow and artifacts
- Read docs/agents/project-profile.md before choosing commands, artifact
  locations, or project terminology.
- Before interface work, read docs/product/ui-ux-design.md and applicable approved
  decisions listed in the profile. Existing implementation is not evidence that
  a disputed design was approved.
- Update the relevant document when a task changes a recorded project fact or an
  approved design. Keep decisions out of conversation-only history.

## Validation
- Run the profile's validation baseline before reporting a change complete.
- Verify interface changes in the running web app using ChatGPT's built-in
  browser-use tool. Exercise affected interactions and check their outcomes.
  Screenshots show the final appearance only; they do not replace interaction
  verification. Before-and-after screenshots are no longer required.
- Report checks that were not run and evidence that could not be obtained.
- Report the requested changes and each nearby fix separately. Passing tests does
  not expand the authorized scope.

## Maintenance
- Keep this file for durable rules. Project facts belong in the profile; approved
  designs belong in decision documents; progress and validation belong elsewhere.
- A recurring failure becomes a proposed minimal rule. Add it here after the user
  confirms it.
