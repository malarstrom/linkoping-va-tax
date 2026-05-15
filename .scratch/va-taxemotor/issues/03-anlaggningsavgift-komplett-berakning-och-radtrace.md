Status: ready-for-agent

## What to build

Build the anläggningsavgift calculation path end-to-end, including property type handling, service selection, shared connection rules, samfällighet reduction, tomtyteavgift, bostadsenhetsavgift, added services, added tomtyta, and Df without an established förbindelsepunkt. The result must include total, line-item breakdown, source paragraphs, and ordered rule trace.

## Acceptance criteria

- [ ] The calculation supports bostadsfastighet, annan fastighet, and obebyggd fastighet.
- [ ] The calculation supports V, S, Df, and Dg where the tax allows it.
- [ ] Shared förbindelsepunkt handling splits the relevant fee correctly.
- [ ] Samfällighet reduction is applied where applicable.
- [ ] Tomtytebegränsningsregeln is enforced.
- [ ] Added tomtyta, added bostadsenheter, and added servisledningar are handled.
- [ ] The result includes per-line source paragraph references and ordered rule trace.

## Blocked by

- .scratch/va-taxemotor/issues/01-lokalt-arbetsutrymme-fastighetsprofil-revisioner.md
- .scratch/va-taxemotor/issues/02-taxeversion-registry-och-manualt-versionval.md
