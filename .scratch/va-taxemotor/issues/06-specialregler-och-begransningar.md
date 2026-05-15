Status: ready-for-human

## What to build

Build the cross-cutting special-rule layer for the VA tax motor. This slice should ensure rule-level enforcement for min/max limits, recurring caps, special-case activation per version, and adjustment/audit requirements across both anläggningsavgift and brukningsavgift flows.

Implementation should follow `CODING_STANDARDS.md`.

## Acceptance criteria

- [x] The motor enforces tax limits and caps from the selected taxeversion.
- [x] Rules can be enabled or disabled per taxeversion.
- [x] Manual line adjustments require a reason and remain in audit trace.
- [x] The engine can show the exact rules used in order.
- [x] The engine separates calculated amount from billed amount.

## Blocked by

None
