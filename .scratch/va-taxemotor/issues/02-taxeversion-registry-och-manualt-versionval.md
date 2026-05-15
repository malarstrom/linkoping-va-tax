Status: ready-for-human

## What to build

Build the taxeversion registry and manual version selection flow. Taxeversioner should live as app-owned structured data, not as imported user data, and each version must have a disjoint validity interval. A calculation should always be bound to the version chosen at runtime, with the ability to rerun the same profile against another version later.

Implementation should follow `CODING_STANDARDS.md`.

## Acceptance criteria

- [x] The app exposes at least one versioned tax data set from the reference document.
- [x] Taxeversioner have explicit validity dates and cannot overlap.
- [x] A calculation can be started by manually selecting a taxeversion.
- [x] Saved calculations remain bound to the chosen taxeversion.
- [x] The app can rerun the same profile against a different taxeversion.

## Blocked by

- .scratch/va-taxemotor/issues/01-lokalt-arbetsutrymme-fastighetsprofil-revisioner.md
