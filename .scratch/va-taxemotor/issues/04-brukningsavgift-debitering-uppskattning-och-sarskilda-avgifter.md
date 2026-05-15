Status: ready-for-agent

## What to build

Build the brukningsavgift calculation path end-to-end, including recurring billing intervals, estimated consumption, annual meter-reading handling, property transfer handling, dröjsmålsränta, VAT, and särskilda avgifter for meter work and other service actions. The result must include total, line-item breakdown, source paragraphs, and ordered rule trace.

## Acceptance criteria

- [ ] The calculation supports brukningsavgift for bebyggd fastighet and obebyggd fastighet where applicable.
- [ ] The app supports monthly, quarterly, tertial, and semiannual billing intervals.
- [ ] Estimated billing is supported where the tax allows it.
- [ ] Meter reading and billing at least once per year is supported.
- [ ] Billing on property transfer request is supported.
- [ ] Dröjsmålsränta is supported for late payment.
- [ ] VAT is represented as a separate component.
- [ ] Särskilda avgifter such as meter handling, shutoff, restart, inspection, and wasted visit are supported.

## Blocked by

- .scratch/va-taxemotor/issues/01-lokalt-arbetsutrymme-fastighetsprofil-revisioner.md
- .scratch/va-taxemotor/issues/02-taxeversion-registry-och-manualt-versionval.md
