# Windows unpacked desktop package verification — 2026-10-30

## Failure and correction

The explicit Electron resource list omitted `src/server/goalValidation.js` and
`src/server/goalLibrary.js`, both referenced by the desktop storage modules.
The original package therefore failed in the main process before opening a
window. Adding only the first missing file was insufficient.

The packaging configuration now includes both helpers. `verify-package.cjs`
recursively follows literal relative CommonJS imports from the main and preload
entries using the packaged source, and rejects missing dependencies with the
importing file and specifier. The prior `release-fixed/win-unpacked` package is
rejected with `src/server/dataStore.js -> ./goalLibrary`.

## Verified artifact

- Directory: `release/desktop-ready/win-unpacked/`
- Entry: `AuraReader.exe` (Windows x64, version 1.0.0)
- app.asar SHA256: `fd2fa81fc813661388fdc485db1063d8f29a52bd40f99aaa28e889183511b660`
- Production build and strict TypeScript/contract checks passed.
- Unpacked Electron build passed, including ASAR integrity and fuse setup.
- Package resource, license, fuse, and recursive local dependency checks passed
  (14 reachable local modules).
- Launched this exact executable through Windows Computer Use and inspected its
  rendered window: the Library page and book list loaded without a main-process
  error dialog. The running application was left open.

## Limitations

The packaged stability runner exited before a debugging endpoint appeared,
with Windows process exit code `2147483651` (`0x80000003`) and no useful output.
Its assertion now includes exit code and signal for diagnosis. The automated
storage/crash/recovery scenarios did not run; direct Windows launch succeeded.
No NSIS installer was built or installation workflow verified in this correction.
The earlier `release/win-unpacked` and `release-fixed/win-unpacked` outputs are
superseded by the verified directory above.
