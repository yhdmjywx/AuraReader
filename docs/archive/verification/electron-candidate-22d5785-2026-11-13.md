# Electron candidate verification: 22d5785

## Scope and source

- AuraReader 1.0.0, Windows x64 NSIS, electron-builder 26.15.3,
  Electron 45.0.0, Node 24.16.0, npm 11.13.0.
- Application source: `22d5785bfc3c78731f5503c05d4732d225eeafe0`.
  Application/build sources match this commit. The authorized test-fixture repair
  and release-profile maintenance remain uncommitted. Existing document changes
  and `release-fixed/` were preserved.
- Run records: `.local-materials/electron-release-22d5785/`. Earlier packages are
  not evidence for this candidate.

## Source and desktop validation

- Dependency tree and package/lockfile version consistency passed.
- `npm test` completed all 82 checks: 81 passed; the volume-title flow test failed
  before its assertions because its partial LayoutController stub lacked the new
  `updateLayoutClasses` method. Strict TypeScript and Vite builds passed.
- With owner approval, the fixture now uses the real LayoutController for both
  Page and Scroll modes. All original assertions remain. The focused command
  `node tests/regression/test_volume_title_flow.js` passed after this repair.
  The other 81 checks were retained because this test-only change does not affect
  their separate Node processes or application inputs. This is combined evidence,
  not a claim that the original `npm test` invocation exited zero.
- All 16 migration cases ran successfully inside that full suite, with the same
  setup/assertions as migration mode. A separate migration invocation and redundant
  typecheck/build were not performed.
- `node scripts/test-desktop.cjs` passed using the suite's current build output:
  React reading workflow, native empty close, and failed-save close protection.
  Artifacts: `.commandcode/desktop-tests/run-7QCFpa/`. The SQLite locked error is
  intentional fault injection; the test verifies close refusal and later recovery.

## Build and actual package checks

- `npm run dist:win` passed, including its production build, resource generation,
  NSIS build, and package verifier. No separate duplicate `verify:package` run.
- Static verification: 8,094 ASAR entries, 66 renderer resources and 20 local
  modules; required resources, actual hardening fuses and notices passed.
- All local ASAR modules equal the current source bytes. The NSIS-embedded EXE
  and ASAR match the unpacked candidate byte-for-byte, extracted without executing
  the installer. See `release/installer-verification.json`.
- Existing standalone packaged EPUB acceptance ran through a bounded temporary
  wrapper that adds reading-settings UI checks to the same lifecycle run.
  Application copied outside the checkout; isolated profile; no development Node
  on PATH; network offline. Final artifacts:
  `.commandcode/packaged-epub/run-tCvBwO/`.
- Actual packaged Web Worker import, Readium CSS (15,214 bytes), nested publication
  CSS, font, image and IPC persistence passed. Reload, last-input save on normal
  close, restart, exact book/Goal/font preservation and both natural exit codes
  (0, 0) passed. No forced exit was counted as success.
- New controls passed mouse and native keyboard activation, 0.05 line-spacing
  change, 40px width change, Page/Scroll switching, unchanged source text, three
  Paper backgrounds, no geometry-changing root borders, the 52px toolbar slot,
  toolbar hide/hover, and Escape dismissal. No captured renderer error occurred.
  The dark settings screenshot was visually inspected. Fixed layout, RTL/vertical,
  protected markup and coalesced layout are covered by the source regression;
  this package check is not a complete EPUB conformance or visual matrix.
- Supplemental harness diagnostics were preserved. Enter simulation initially
  omitted the character event used by existing desktop tests; a subsequent Paper
  assertion sampled the 200ms background transition. The final check sends the
  character event and waits at most 1 second for the exact expected color, without
  changing application styles or assertion values. The installer helper switched
  from an unavailable legacy module to builder's cached 7za, then handled the
  observed directly embedded 7z payload. No dependency installation was needed.

## Candidate artifacts

- `release/AuraReader-Setup-1.0.0-x64.exe`: 131,653,247 bytes.
- Installer SHA256:
  `ed6ef989709cdb22ac80bb676aee9c1d9707f341bccd4a973e559619cd656020`.
- ASAR SHA256:
  `60a63853676124cf2ba7c5fe5fd7b218e59885175e4f1a382b33366ef717e007`.
- Reports: `release/package-verification.json`,
  `release/runtime-verification.json`, `release/installer-verification.json`.
- Installer and executable Authenticode status: NotSigned. Build log signing
  messages are not evidence of a digital signature.
- Real installation, upgrade, uninstall and clean-machine testing were not run.
  No everyday library was accessed.

## Remote boundary

Local delivery is complete. The owner subsequently requested GitHub Release work
after three hours, recorded as not-before `2026-11-13T18:41:57Z` (2026-11-14
02:41:57 Asia/Shanghai), then explicitly approved pushing the four existing
commits to `codex/release-1.0.0` and creating a draft with the five exact assets.

After the deadline, all source/evidence/artifact fingerprints were rechecked and
matched. Existing valid tests and package evidence were reused. The authorized
branch was pushed and verified at `22d5785`; remote main remains `337e683`.
The local fixture repair, profile updates and verification document were not
included in those four existing commits and remain local.

Draft URL:
https://github.com/yhdmjywx/AuraReader/releases/tag/untagged-a5db93370911ac955f60

The persisted draft has tag `v1.0.0`, target `codex/release-1.0.0`, the exact
prepared title/notes, and five uploaded assets. GitHub's server SHA256 digests
match the local manifest for the installer, SHA256 sidecar, package report,
runtime report and installer-payload report. Digest equality establishes byte
identity and binds the exact local sizes, in addition to GitHub's displayed
rounded sizes. Saved evidence: `github-asset-verification.json` and
`github-draft-verification.json` in the ignored run directory. The browser draft
page explicitly reports Draft. No release was published; exact-draft publication
requires separate approval. No tag was published by this draft-only workflow.

## Formal publication: 2026-11-14

The owner explicitly approved formal publication of this exact draft. Before
publication, the saved tag, target branch, notes, five asset digests and local
evidence were rechecked. No new build or duplicate application test run was needed.

- Published on 2026-11-14 at 08:04:20 Asia/Shanghai (`2026-11-14T00:04:20Z`).
- Release: https://github.com/yhdmjywx/AuraReader/releases/tag/v1.0.0
- GitHub release ID: `444606837`; `draft: false`, `prerelease: false`; the page
  displays Latest.
- The published `v1.0.0` tag resolves to the verified application commit
  `22d5785bfc3c78731f5503c05d4732d225eeafe0`. Remote main remains `337e683`.
- Public GitHub API verification confirmed all five uploaded asset names, exact
  byte sizes and server SHA256 digests against the approved manifest. The two
  additional source archive links are generated by GitHub.
- Release notes match the approved text after CRLF-to-LF normalization; the
  GitHub form stored CRLF. Binary and attachment digests use raw bytes.
- Publication evidence is saved in `publish-preflight.json` and
  `published-verification.json` in the ignored run directory. This publication
  supersedes the earlier draft-only status. The unchanged unsigned/installation
  limitations remain disclosed in the public release notes.
