# VA taxemotor PRD

Status: ready-for-agent

## Problem Statement

A user needs a motor that can calculate VA charges for connecting a house to the public VA network using the authoritative tax document `taxeföreskrifter och priser från 1 september 2026`.

The motor must support all chargeable rules in the document, including both one-time anläggningsavgift and recurring brukningsavgift, multiple property types, multiple service combinations, versioned tax rules, saved property profiles, historical changes, and traceable line-by-line calculations.

## Solution

Build a versioned VA tax calculation motor that lets the user define a property profile, choose a taxeversion manually, select applicable services and special cases, and receive a complete calculation with total, line-item breakdown, and full rule traceability.

The motor will support all rules in the reference document, preserve calculation history, and allow both preliminary and final billing flows.

## User Stories

1. As a property owner, I want to calculate VA charges for my property, so that I understand the cost of connecting to the public network.
2. As a case handler, I want to choose between bostadsfastighet, annan fastighet, and obebyggd fastighet, so that I can use the correct rule set.
3. As a case handler, I want to select services separately for V, S, Df, and Dg, so that the calculation matches the applicable tax rules.
4. As a case handler, I want Dg to be available only when the property is allmän platsmark, so that the motor follows the tax boundaries.
5. As a case handler, I want to enter tomtyta as a decimal number in square meters, so that the motor can calculate area-based charges precisely.
6. As a case handler, I want to enter antal bostadsenheter as a whole number, so that bostadsenhetsavgift is calculated correctly.
7. As a case handler, I want to calculate a property with any valid combination of services, so that the motor can handle real-world connection scenarios.
8. As a case handler, I want the motor to support gemensam förbindelsepunkt, so that shared connection costs are split correctly.
9. As a case handler, I want samfällighet to reduce the förbindelsepunktsavgift when applicable, so that special ownership structures are handled correctly.
10. As a case handler, I want the motor to handle anstånd for tomtyteavgift, so that deferred area charges can be calculated.
11. As a case handler, I want the motor to support särtaxa and special agreements on fee size, so that exceptional cases can be handled within the rule framework.
12. As a case handler, I want the motor to support tillkommande tomtyta, so that later area increases are charged correctly.
13. As a case handler, I want the motor to support tillkommande bostadsenheter, so that later additions to the property are charged correctly.
14. As a case handler, I want the motor to support additional servisledningar and förbindelsepunkter later in time, so that new connection work can be charged correctly.
15. As a case handler, I want avgiftsskyldighet to be able to arise at different times for V, S, and Df, so that staged connection scenarios are supported.
16. As a case handler, I want Df to be possible without an established förbindelsepunkt when the tax allows it, so that special drainage situations are covered.
17. As a case handler, I want brukningsavgift to be debitable monthly, quarterly, tertially, or semiannually according to the principal's decision, so that billing cadence can follow local policy.
18. As a case handler, I want brukningsavgift to support billed, estimated, or otherwise approved consumption bases, so that interim billing can work.
19. As a case handler, I want meter reading and billing to occur at least once per year and on request during property transfer, so that recurring billing stays compliant.
20. As a case handler, I want preliminary estimates and final calculations to both be supported, so that I can work before all facts are known and then settle later.
21. As a case handler, I want to save property profiles, so that I can reuse the same property data across calculations.
22. As a case handler, I want saved profiles to keep history, so that changes in property conditions remain traceable.
23. As a case handler, I want calculations to be versioned, so that I can see what was computed at a specific point in time.
24. As a case handler, I want a saved calculation to be editable through a new version or direct edit with history, so that corrections do not destroy the audit trail.
25. As a case handler, I want manual adjustments to require a reason per line, so that deviations are auditable.
26. As a case handler, I want each calculation to show the exact rules used in order, so that the result can be verified against the tax document.
27. As a case handler, I want each line item to show its source paragraph, so that the calculation is transparent.
28. As a case handler, I want the motor to support multiple taxeversioner, so that historical and future tax changes can coexist.
29. As a case handler, I want to select the taxeversion manually at runtime, so that I can compare versions deliberately.
30. As a case handler, I want taxeversioner to have disjoint validity intervals, so that version conflicts are avoided.
31. As a case handler, I want importing a new taxeversion to create a new version instead of changing the old one, so that historical calculations remain stable.
32. As a case handler, I want imported taxeversioner to be administratively maintained rather than edited in the normal UI, so that rule data stays controlled.
33. As a case handler, I want the motor to enforce minimum and maximum rule limits from the tax, so that no calculation exceeds allowed bounds.
34. As a case handler, I want the motor to support tomtytebegränsningsregeln, so that area charges are capped correctly.
35. As a case handler, I want the motor to support the rule that tomtyteavgift cannot exceed 100% of servisavgift over time, so that cumulative limits are respected.
36. As a case handler, I want different rules to be activatable per taxeversion, so that version-specific behavior is controlled.
37. As a case handler, I want the motor to separate bereknad avgift from debiterad avgift, so that billing and calculation are not conflated.
38. As a case handler, I want the motor to support recurring billing over time as well as one-time calculations, so that both VA charge families are covered.
39. As a finance user, I want the motor to support dröjsmålsränta on late payment, so that the billing result can include statutory interest handling.
40. As a finance user, I want the motor to support särskilda avgifter such as meter removal, meter installation, shutoff, restart, meter inspection, tank cleaning, and wasted visit fees, so that service work is billed correctly.
41. As a finance user, I want the motor to support moms as a separate component, so that the final amount can be presented correctly.
42. As a reviewer, I want calculations to be done per property and optionally summarized across multiple properties, so that batch handling stays auditable.
43. As a reviewer, I want multiple properties in one run to remain independent, so that one case does not affect another.
44. As a reviewer, I want the motor to support import and export of property profiles and taxeversioner, so that data can be moved between environments.
45. As a reviewer, I want a saved property profile to stay bound to the selected taxeversion for the calculation, so that reruns are reproducible.
46. As a reviewer, I want the motor to support both exact calculated values and presentation rounding, so that internal precision is preserved.
47. As a reviewer, I want the motor to support future recalculation against another taxeversion, so that historical scenarios can be compared.
48. As a reviewer, I want the motor to be able to calculate all rules from the document, so that no tax-relevant branch is missed.

## Implementation Decisions

- Build a deep **rule engine** that models tax rules per paragraph and can activate or deactivate rules per taxeversion.
- Build a **taxeversion registry** that stores versioned tax data with disjoint validity intervals and manual selection at runtime.
- Build a **calculation engine** that accepts one property at a time, but can be invoked in batch for multiple independent properties.
- Build a **property profile model** that stores relevant inputs only, with history for changes over time.
- Build a **calculation history model** that distinguishes saved profile history, calculated result history, and debited result history.
- Support both **anläggningsavgift** and **brukningsavgift** in the same system, with separate rule branches and output sections.
- Support **bostadsfastighet**, **annan fastighet**, and **obebyggd fastighet** as separate property types.
- Treat **obebyggd fastighet** as its own first-class property type, not merely a flag.
- Use **bostadsenhet** as the canonical internal term, not lägenhet.
- Support **V**, **S**, **Df**, and **Dg** with service availability constrained by property type and tax rules.
- Support preliminary and final calculation modes, but keep the same underlying rule engine.
- Support estimate-based billing for brukningsavgift where the tax allows it.
- Support recurring billing intervals chosen by the principal.
- Support shared connection handling, samfällighet reduction, added servisledningar, added förbindelsepunkter, added tomtyta, added bostadsenheter, and Df without established förbindelsepunkt.
- Support special-charge rules such as meter operations, shutoff/restart, inspection, and other special measures.
- Include per-line rule provenance in the result payload, including paragraph references and rule order.
- Preserve both internal numeric precision and presentation-layer rounding.
- Keep tax data as structured configuration/admin data imported as new versions rather than edited in place.
- Use manual taxeversion selection during calculation runs.
- Enforce audit reasons for manual line adjustments.
- Support VAT as a separate charge component.

## Testing Decisions

- Test only external behavior of the public calculation interfaces, not internal rule execution details.
- Add focused unit tests for the rule engine, especially paragraph-level decisions and caps.
- Add parameterized tests for property type and service combinations.
- Add regression tests using representative examples from the reference tax document.
- Add tests for version selection, disjoint validity intervals, and re-running a profile against another taxeversion.
- Add tests for shared connection, samfällighet reduction, tomtytebegränsning, and cumulative 100% cap behavior.
- Add tests for brukningsavgift intervals, estimated billing, and annual meter-reading rules.
- Add tests for history and audit behavior when calculations or profiles are changed.
- Add tests for line-item provenance output and ordered rule traces.
- Prior art in this repo is currently minimal, so these tests will establish the first behavior-focused suite.

## Out of Scope

- Payment processing, reminders, and accounting integration.
- UI design polish beyond what is needed to operate the motor.
- Automatic OCR or arbitrary PDF parsing workflows for tax documents beyond importing structured tax data.
- Non-VA tax domains.
- Legal advice or dispute handling.
- Human approval workflows for the calculation result.

## Further Notes

The reference document does not specify a rounding rule, so the motor should preserve full precision internally and round in presentation as a product decision.

The document also contains the rule that brukningsavgift may be debited on estimated consumption between meter readings, while anläggningsavgift is tied to the moment when avgiftsskyldighet inträder.

The system should remain fully traceable: every result should be explainable back to the applicable taxeversion and paragraph-level rule chain.

Implementation should follow `CODING_STANDARDS.md` for TypeScript, React, persistence, and calculation conventions.
