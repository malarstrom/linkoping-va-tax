Status: ready-for-human

## What to build

Build the anläggningsavgift calculation path end-to-end, including property type handling, service selection, shared connection rules, samfällighet reduction, tomtyteavgift, bostadsenhetsavgift, added services, added tomtyta, and Df without an established förbindelsepunkt. The result must include total, line-item breakdown, source paragraphs, and ordered rule trace.

Implementation should follow `CODING_STANDARDS.md`.

## Acceptance criteria

- [x] The calculation supports bostadsfastighet, annan fastighet, and obebyggd fastighet.
- [x] The calculation supports V, S, Df, and Dg where the tax allows it.
- [x] Shared förbindelsepunkt handling splits the relevant fee correctly.
- [x] Samfällighet reduction is applied where applicable.
- [x] Tomtytebegränsningsregeln is enforced.
- [x] Added tomtyta, added bostadsenheter, and added servisledningar are handled.
- [x] The result includes per-line source paragraph references and ordered rule trace.

## Blocked by

None
