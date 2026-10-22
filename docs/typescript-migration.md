# TypeScript migration

The existing feature boundaries remain: main wires controllers; the coordinator
owns cross-feature operations; domain functions model reading and annotations;
repositories own persistence. Types do not route runtime calls.

1. Shared contracts and mixed JS/TS build.
2. Domain algorithms and state models.
3. Derived book structure and storage client/repositories/recovery.
4. Controller interfaces and application bootstrap.

`npm run build` checks TypeScript in strict mode and emits the mixed client graph
into ignored `dist/`. Existing JavaScript remains unchecked during migration.
Browser URLs retain `.js` extensions. The server serves those files from
`dist/client`; HTML, CSS and assets remain in `src/client`. `npm start` builds
first. Run `npm run build` after changing sources when running Node directly.
Tests import the same emitted modules as the browser. `npm test` builds first.

Source `page` remains a 1-based original document coordinate. Screen columns and
derived reading units must not overwrite persisted book pages or note offsets.
Book structure trees contain parent references and are never serialized as books.
Legacy annotation input remains distinct from normalized UI data. Unknown JSON
fields and existing validation/recovery behavior are preserved. Shared storage
types describe wire commands/results; HTTP, backup and database validators still
run at runtime. No unchecked `as Book` replaces input validation.

## Completed scope

- Batch 1: shared book/annotation/font/storage contracts, strict compiler,
  mixed source build, server static routing and tests against emitted modules.
- Batch 2: reading locations/engine, chapter flow calculations, annotation
  normalization/ranges and font selection.
- Batch 3: derived book structure, typed route requests/results, repositories
  and discriminated pending save/delete operations.
- Batch 4: reader/annotation/selection controllers, session, shell, coordinator
  and main bootstrap. Controller callbacks and DOM elements have explicit
  contracts. JavaScript renderers and secondary controllers expose JSDoc
  interfaces to their TypeScript callers.

`app/contracts.ts` describes callback and presentation interfaces; domain types
stay with the domain and storage commands stay in `shared/storage.ts`. Main
continues to assemble instances and wire callbacks. Interfaces are erased when
compiled; there is no extra runtime gateway or duplicate application state.

Remaining JavaScript includes DOM renderers, EPUB/backup parsing, secondary
controllers, legacy migration, the compatibility facade and the Node server.
`checkJs` remains disabled: JSDoc checks their TypeScript call sites, not their
implementation bodies. This is a deliberate incremental boundary, not full
project coverage. Runtime validation and the latest-request book-switch guard
continue to be necessary; types alone cannot prevent asynchronous races.

`tests/types/contracts.mts` contains compiler-only positive and negative
examples. Both build and typecheck run them; an API that accepts an invalid
example fails the check because its `@ts-expect-error` becomes unused.
