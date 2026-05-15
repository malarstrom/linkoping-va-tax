Status: ready-for-human

## What to build

Build JSON import/export for all user data, including property profiles, calculations, revisions, manual adjustments, and full audit trace. Import must detect object identity via UUID, surface conflicts, and let the user choose merge behavior per conflicting object. Export must preserve schema version and enough metadata to reconstruct history.

Implementation should follow `CODING_STANDARDS.md`.

## Acceptance criteria

- [x] The app can export all user data into one JSON package.
- [x] The export includes schema version and full audit trace.
- [x] Import can recognize matching objects by UUID and related metadata.
- [x] Import can merge conflicts with user input per object.
- [x] Import tolerates future additive schema fields.
- [x] Imported data retains calculation and profile history.

## Blocked by

None
