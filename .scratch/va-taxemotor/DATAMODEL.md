# VA taxemotor datamodell

## Designmål

- All användardata lagras lokalt i webbläsaren.
- Taxeversioner är app-data, inte användardata.
- Alla ändringar ska vara spårbara via revisioner.
- Beräkningsresultat ska kunna förklaras rad för rad.
- Import/export ska kunna slå ihop objekt med GUID/UUID som identitet.

## Kanoniska domänobjekt

### Workspace
Ett enda gemensamt arbetsutrymme per installation/webbläsare.

### PropertyProfile
En sparad fastighetsprofil.

Fält:
- `id` (UUID)
- `name`
- `propertyType` (`bostadsfastighet`, `annan fastighet`, `obebyggd fastighet`)
- `serviceSelections` (`V`, `S`, `Df`, `Dg` där tillämpligt)
- `tomtyta` (decimal)
- `bostadsenheter` (heltal)
- `ownershipShares` (valfritt, för delad ägarfördelning)
- `createdAt`, `updatedAt`
- `currentRevisionId`

### PropertyProfileRevision
Immutable snapshot av en profil vid en viss tidpunkt.

Fält:
- `id` (UUID)
- `profileId`
- `revisionNo`
- `snapshot`
- `changedByAction`
- `createdAt`

### CalculationCase
En beräkningscontainer för en profil och en vald taxeversion.

Fält:
- `id` (UUID)
- `profileId`
- `taxVersionId`
- `mode` (`preliminary` | `final`)
- `status`
- `currentRevisionId`
- `createdAt`, `updatedAt`

### CalculationRevision
Immutable snapshot av en beräkning.

Fält:
- `id` (UUID)
- `calculationCaseId`
- `revisionNo`
- `inputSnapshot`
- `resultSnapshot`
- `ruleTrace`
- `manualAdjustments`
- `createdAt`

### TaxVersion
Kodad taxeversion i appens registry.

Fält:
- `id`
- `label`
- `validFrom`
- `validTo`
- `enabledRules`
- `taxValues`

### TaxRule
En regel per paragraf/avgiftsdel.

Fält:
- `id`
- `paragraphRef`
- `appliesTo`
- `inputs`
- `formula`
- `limits`
- `sourceText`

### CalculationLine
En rad i resultatet.

Fält:
- `id` (UUID)
- `component` (`anläggningsavgift`, `brukningsavgift`, `moms`, `särskild åtgärd`)
- `paragraphRef`
- `description`
- `basis`
- `amount`
- `precision`
- `ruleIds`

### ManualAdjustment
Manuell justering med motivering.

Fält:
- `id` (UUID)
- `targetLineId`
- `reason`
- `delta`
- `createdAt`

### ImportExportPackage
JSON-paket för flytt mellan enheter.

Fält:
- `schemaVersion`
- `exportedAt`
- `workspace`
- `profiles`
- `calculations`
- `deletedRecords`
- `auditTrace`

## Persistens

- `IndexedDB`: all användardata, revisioner, beräkningar, historik, import/export-innehåll.
- `localStorage`: UI-preferenser och små inställningar utan affärsvärde.

## Versionsprinciper

- In-place-ändring undviks för profiler och beräkningar.
- Ny ändring skapar ny revision.
- Import skapar nya objekt eller mergar mot befintliga via GUID + metadata.
- Taxeversioner importeras inte som användardata utan levereras av appen.
