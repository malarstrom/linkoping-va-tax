Status: ready-for-human

## What to build

Build the brukningsavgift calculation path end-to-end, including recurring billing intervals, estimated consumption, annual meter-reading handling, property transfer handling, dröjsmålsränta, VAT, and särskilda avgifter for meter work and other service actions. The result must include total, line-item breakdown, source paragraphs, and ordered rule trace.

Implementation should follow `CODING_STANDARDS.md`.

## Acceptance criteria

- [x] The calculation supports brukningsavgift for bebyggd fastighet and obebyggd fastighet where applicable.
- [x] The app supports monthly, quarterly, tertial, and semiannual billing intervals.
- [x] Estimated billing is supported where the tax allows it.
- [x] Meter reading and billing at least once per year is supported.
- [x] Billing on property transfer request is supported.
- [x] Dröjsmålsränta is supported for late payment.
- [x] VAT is represented as a separate component.
- [x] Särskilda avgifter such as meter handling, shutoff, restart, inspection, and wasted visit are supported.

## Blocked by

None
