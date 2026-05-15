Status: ready-for-agent

## What to build

Build the cross-cutting special-rule layer for the VA tax motor. This slice should ensure rule-level enforcement for min/max limits, recurring caps, special-case activation per version, and adjustment/audit requirements across both anläggningsavgift and brukningsavgift flows.

## Acceptance criteria

- [ ] The motor enforces tax limits and caps from the selected taxeversion.
- [ ] Rules can be enabled or disabled per taxeversion.
- [ ] Manual line adjustments require a reason and remain in audit trace.
- [ ] The engine can show the exact rules used in order.
- [ ] The engine separates calculated amount from billed amount.

## Blocked by

- .scratch/va-taxemotor/issues/02-taxeversion-registry-och-manualt-versionval.md
- .scratch/va-taxemotor/issues/03-anlaggningsavgift-komplett-berakning-och-radtrace.md
- .scratch/va-taxemotor/issues/04-brukningsavgift-debitering-uppskattning-och-sarskilda-avgifter.md
