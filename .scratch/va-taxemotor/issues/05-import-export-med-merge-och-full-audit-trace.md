Status: ready-for-agent

## What to build

Build JSON import/export for all user data, including property profiles, calculations, revisions, manual adjustments, and full audit trace. Import must detect object identity via UUID, surface conflicts, and let the user choose merge behavior per conflicting object. Export must preserve schema version and enough metadata to reconstruct history.

## Acceptance criteria

- [ ] The app can export all user data into one JSON package.
- [ ] The export includes schema version and full audit trace.
- [ ] Import can recognize matching objects by UUID and related metadata.
- [ ] Import can merge conflicts with user input per object.
- [ ] Import tolerates future additive schema fields.
- [ ] Imported data retains calculation and profile history.

## Blocked by

- .scratch/va-taxemotor/issues/01-lokalt-arbetsutrymme-fastighetsprofil-revisioner.md
- .scratch/va-taxemotor/issues/03-anlaggningsavgift-komplett-berakning-och-radtrace.md
- .scratch/va-taxemotor/issues/04-brukningsavgift-debitering-uppskattning-och-sarskilda-avgifter.md
