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
