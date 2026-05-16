# Implementeringsplan: 2026-09-01 taxedata + korrekt regelmotor

## Bakgrund

Status efter genomgång:

- Beloppen/prisdata stämmer i huvudsak mot skriften för `2026-09-01`.
- Juridisk regelmotor stämmer inte fullt ut.
- Live-visningen visar inte alltid samma belopp som sparat läge: korrekt beräkning uppstår först när användaren trycker **Spara**. Mål: livevisning och sparad beräkning ska använda exakt samma beräkningsväg och scenarioinput.

## Mål

Efter implementation ska appen kunna svara:

- Prisdata: ja.
- Regelmotor: ja, för de regler som stöds.
- Liveförhandsvisning: samma resultat som en sparad beräkning med samma profil, taxeversion och scenario.
- Beräkningen ska vara spårbar per avgiftsrad med regel, procentsats/reduktion, underlag, moms och totalsumma.

## Huvudprincip

Flytta från hårdkodade totalsummor per rad till en regelmodell där varje avgiftskomponent beräknas som:

```text
basbelopp × fastighetstypregel × tjänsteandelar × specialregel × eventuell begränsning
```

Samma funktion ska användas av:

- liveförhandsvisning
- sparad beräkning
- omräkning av sparad beräkning
- manuell justeringens grundsnapshot

## Status efter första implementation

Genomfört:

- `calculatePreview` och `createCalculationCase` använder nu samma scenario-aware beräkningsväg.
- Liveförhandsvisningen räknas om när anläggningsscenario eller brukningsscenario ändras.
- `src/domain/service-shares.ts` finns som gemensam infrastruktur för V/S/Df/Dg-andelar.
- `src/domain/vat.ts` finns som gemensam momshjälp.
- Anläggningsavgift har första implementation av tjänsteandelar och momsrad.
- Brukningsavgift har första implementation av tjänsteandelar för grundavgift, vatten, dagvatten och mätare.
- Unit, build och e2e passerade efter första implementationen.

Kvar innan regelmotorn kan kallas juridiskt korrekt:

- Exakta tabellandelar för §5.1 b-e, §6.1 b-d och §13/§16 är transkriberade och inlagda i `service-shares.ts`; kvar är bredare testmatris över alla kombinationer.
- §6 och §7 behöver egen regelmodell, inte bara paragrafalias till §5-logik.
- Df utan förbindelsepunkt behöver jämföras mot skriften rad för rad.
- Tomtytebegränsningen är fortfarande förenklad.
- UI visar ännu inte all metadata (`baseAmount`, `share`, `reductionReason`) på ett användarvänligt sätt.

## Föreslagen arbetsordning

### 1. Samla gemensam beräkningsinput

Status: **genomfört i första implementationen**. Behåll regressionstestet som låser live = sparat läge.

Berörda filer:

- `src/domain/calculate.ts`
- `src/domain/calculations.ts`
- `src/App.tsx`
- `src/domain/types.ts`

Åtgärder:

1. Inför en gemensam funktion, t.ex. `calculateCaseResult(profile, taxVersion, anlaggningsScenario, brukningsScenario)`.
2. Låt både `calculatePreview` och `createCalculationCase` använda samma funktion.
3. Ändra `calculatePreview` så den tar scenarioinput:

```ts
calculatePreview(profile, taxVersion, anlaggningsScenario, brukningsScenario)
```

4. Uppdatera `src/App.tsx` så `livePreview` beror på:
   - `activeProfile`
   - `activeTaxVersion`
   - `anlaggningsScenario`
   - `brukningsScenario`
5. Lägg till regressionstest som bevisar:
   - live-resultatet med aktuella scenarios är identiskt med första revisionens `resultSnapshot` efter `createCalculationCase`.

Acceptans:

- Ändring av t.ex. Df utan förbindelsepunkt, debiteringsintervall, uppskattad förbrukning eller specialåtgärd syns direkt i livevisningen.
- Spara skapar ingen annan totalsumma än livevisningen hade precis före klicket.

### 2. Modellera tjänsteandelar för V/S/Df/Dg

Status: **infrastruktur genomförd och första juridiska tabellvärden inlagda från skriften**. Kvar: bred kombinationstestning och §6/§7-specialfall.

Berörda filer:

- `src/domain/types.ts`
- `src/domain/tax-versions.ts`
- ny fil: `src/domain/service-shares.ts`
- `src/domain/anlaggningsavgift.ts`
- `src/domain/brukningsavgift.ts`

Åtgärder:

1. Lägg till taxevärden eller strukturer för procentandelar per tjänst och avgiftskomponent.
2. Skapa helper, t.ex.:

```ts
serviceShare(component, enabledServices, context): number
```

3. Använd helpern för anläggningsavgiftens rader:
   - servis/förbindelsepunkt
   - tomtyta
   - bostadsenhet/brukningsdel
   - Df/Dg-relaterade avgifter
4. Använd helpern för brukningsavgift:
   - grundavgift V/S
   - dagvatten fastighet Df
   - dagvatten gata Dg om relevant
   - vattenförbrukning bara när V ingår

Acceptans:

- Val av endast V, endast S, V+S, Df, Dg och kombinationer ger procentreducerade avgiftsrader enligt skriftens tabellandelar.
- Regelspåret visar vilka tjänster och andelar som användes.

### 3. Rätta Df utan förbindelsepunkt

Berörda filer:

- `src/domain/anlaggningsavgift.ts`
- `src/domain/service-shares.ts`
- `src/domain/tax-versions.ts`
- `tests/domain/anlaggningsavgift.test.ts`

Åtgärder:

1. Ersätt dagens förenklade `dagvattenutanforbindelsepunkt`-rad med regel enligt §5.1 e / §6.1 d.
2. När `dfWithoutConnection` används ska Df-delen reduceras i relevanta servis-/förbindelsekomponenter, inte bara läggas som fristående schablon om skriften kräver annan behandling.
3. Säkerställ att Df inte dubbelräknas både som vanlig förbindelsetjänst och som Df utan förbindelsepunkt.

Acceptans:

- Testfall med Df markerad och `dfWithoutConnection=true` visar reducerade delar enligt paragraf, inte förenklad helavgift.
- Basis-texten anger reducering och paragraf.

### 4. Rätta fastighetstyperna “annan fastighet” och “obebyggd fastighet”

Berörda filer:

- `src/domain/anlaggningsavgift.ts`
- `src/domain/types.ts`
- `src/domain/tax-versions.ts`
- `tests/domain/anlaggningsavgift.test.ts`

Åtgärder:

1. Skilj regler för:
   - `bostadsfastighet` / §5
   - `annan fastighet` / §6
   - `obebyggd fastighet` / §7
2. Inför fastighetstypspecifika beräkningsstrategier eller regeluppslag.
3. Modellera egna procentsatser och komponenter för §6 och §7 i stället för att återanvända §5 med annat paragrafnummer.

Acceptans:

- Samma profilvärden med olika fastighetstyp ger olika regelutfall där skriften säger det.
- Obebyggd fastighet använder §7-regler och cap enligt §7, inte förenklad §5-logik.

### 5. Lägg moms på anläggningsavgifter

Berörda filer:

- `src/domain/anlaggningsavgift.ts`
- eventuellt ny helper: `src/domain/vat.ts`
- `src/domain/brukningsavgift.ts`
- `tests/domain/anlaggningsavgift.test.ts`
- `tests/domain/calculations.test.ts`

Åtgärder:

1. Flytta momshantering till gemensam helper så den kan användas för både anläggningsavgift och brukningsavgift.
2. Lägg momsrad på anläggningsavgiftens avgiftsunderlag när §2 är aktiv.
3. Säkerställ att moms inte beräknas på redan momsade rader eller dröjsmålsränta om skriften kräver undantag.

Acceptans:

- Anläggningsavgift får momsrad.
- Totalsumma inkluderar moms.
- Momsraden har egen komponent `moms`, paragraf `§2`, och tydlig basis.

### 6. Rätta tomtytebegränsning enligt §5.3 / §7

Berörda filer:

- `src/domain/anlaggningsavgift.ts`
- ny fil: `src/domain/tomtyta.ts`
- `src/domain/tax-versions.ts`
- `tests/domain/anlaggningsavgift.test.ts`

Åtgärder:

1. Ersätt dagens enkla `Math.min(area * rate, cap)` med en explicit tomtyteregel.
2. Regeln ska ta hänsyn till:
   - fastighetstyp
   - valda tjänster/procentandelar
   - relation mellan tomtyteavgift och övriga anläggningsavgifter enligt §5.3 / §7
   - tillkommande tomtyta
3. Returnera både `calculatedAmount`, `billedAmount` och trace-notering när begränsning slår in.

Acceptans:

- Testfall under cap, exakt vid cap och över cap.
- Separata testfall för §5.3 och §7.

### 7. Rätta brukningsavgiftens tjänstereduktion

Berörda filer:

- `src/domain/brukningsavgift.ts`
- `src/domain/service-shares.ts`
- `tests/domain/brukningsavgift.test.ts`

Åtgärder:

1. Grundavgift ska reduceras efter V/S enligt tabellandelar.
2. Vattenförbrukning ska bara beräknas när V är vald.
3. Dagvattenavgifter ska följa Df/Dg enligt tabellandelar.
4. Mätaravgift ska bara beräknas när relevant vattentjänst/mätare används.

Acceptans:

- Brukningsavgiften ändras live när användaren togglar V/S/Df/Dg.
- Df/Dg påverkar dagvattenrad, inte V/S-rader.
- Testfall täcker vanliga kombinationer.

### 8. Förbättra spårbarheten i avgiftsrader

Berörda filer:

- `src/domain/types.ts`
- `src/domain/rule-engine.ts`
- `src/App.tsx`

Åtgärder:

1. Utöka `CalculationLine` med frivilliga metadatafält, t.ex.:

```ts
share?: number;
baseAmount?: number;
reductionReason?: string;
```

2. Visa i UI:
   - grundbelopp
   - andel/reduktion
   - debiterat belopp
   - paragraf
3. Behåll `basis` som människoläsbar sammanfattning.

Acceptans:

- En användare kan se varför beloppet inte är 100 % av prisdata.
- Diff mellan skrift och implementation blir enklare att granska.

### 9. Validera och ersätt exakta tabellandelar från skriften

Status: **påbörjat/genomfört för kärntabellerna**.

Skapat:

- `.scratch/va-taxemotor/2026-09-01-regeltabeller.md`

Inlagt i kod:

- §5.1 b förbindelsepunktsavgift: V/S/Df = 16 583 / 18 242 / 26 534 kr.
- §5.1 c tomtyteavgift: V/S/Df/Dg = 16,35 / 17,95 / 21,25 / 11,45 kr per m².
- §5.1 d bostadsenhetsavgift: V/S = 10 509 / 11 560 kr.
- §5.1 e / §6.1 d Df utan förbindelsepunkt: Df = 35 909 kr.
- §13.1 a grundavgift: V/S = 821 / 1 029 kr per år.
- §13.1 c dagvattenavgift: Df/Dg = 1,25 / 0,65 kr per m² och år.

Berörda filer:

- `src/domain/service-shares.ts`
- `src/domain/tax-versions.ts`
- `tests/domain/anlaggningsavgift.test.ts`
- `tests/domain/brukningsavgift.test.ts`
- ny dokumentationsfil: `.scratch/va-taxemotor/2026-09-01-regeltabeller.md`

Syfte:

Defaultandelarna i `service-shares.ts` gör att motorn tekniskt kan reducera efter tjänster, men de är inte ännu bevisade mot skriftens tabeller. Detta steg låser de juridiska procentsatserna.

Arbetsgång:

1. Skapa `.scratch/va-taxemotor/2026-09-01-regeltabeller.md` som transkriberar relevanta tabeller från skriften.
2. För varje rad i skriften, dokumentera:
   - paragraf
   - avgiftskomponent
   - fastighetstyp
   - tjänst: V, S, Df, Dg
   - procentsats/andel
   - källa/sidnummer om tillgängligt
   - eventuella villkor, t.ex. Df utan förbindelsepunkt
3. Ersätt placeholders i `service-shares.ts` med namngivna tabeller, t.ex.:

```ts
const ANLAGGNING_SERVICE_SHARES_2026_09_01 = {
  bostadsfastighet: {
    servis: { V: ..., S: ..., Df: ..., Dg: ... },
    forbindelsepunkt: { V: ..., S: ..., Df: ..., Dg: ... },
    tomtyta: { V: ..., S: ..., Df: ..., Dg: ... },
    bostadsenhet: { V: ..., S: ..., Df: ..., Dg: ... },
  },
  annanFastighet: { ... },
  obebyggdFastighet: { ... },
};
```

4. Välj om andelarna ska ligga:
   - i kod som taxeversionstabell, om de är stabila och regelstyrda
   - i `taxValues`, om användaren ska kunna versionera/importera dem per taxeversion
5. Skriv regressionstest per tabellrad innan implementationen ändras.
6. Efter implementation: jämför dokumenterad tabell mot `service-shares.ts` i test, så ingen andel saknas.

Acceptans:

- Alla andelar i `service-shares.ts` har spårbar rad i `.scratch/va-taxemotor/2026-09-01-regeltabeller.md`.
- Inga placeholderandelar finns kvar.
- Testerna täcker minst:
  - V
  - S
  - Df
  - Dg
  - V+S
  - V+S+Df
  - Df utan förbindelsepunkt
  - fastighetstyperna §5, §6 och §7
- Ett missat tabellvärde ska ge testfel, inte tyst fallback.

### 10. Teststrategi

Berörda filer:

- `tests/domain/anlaggningsavgift.test.ts`
- `tests/domain/brukningsavgift.test.ts`
- `tests/domain/calculations.test.ts`
- `tests/e2e/va-taxemotor.spec.ts`

Lägg till tester för:

1. Tjänsteandelar V/S/Df/Dg per avgiftskomponent.
2. Df utan förbindelsepunkt.
3. Annan fastighet §6.
4. Obebyggd fastighet §7.
5. Moms på anläggningsavgift.
6. Tomtytebegränsning §5.3 / §7.
7. Brukningsavgiftens reduktion efter valda tjänster.
8. Liveförhandsvisning = sparad beräkning.

E2E-acceptans för livefelet:

1. Ändra scenario i UI.
2. Läs totalsumman i liveförhandsvisningen.
3. Klicka Spara.
4. Kontrollera att sparad totalsumma är exakt samma.

## Rekommenderad implementation i små PR-steg

1. **Live = save**: gemensam beräkningsfunktion och scenarioinput i `calculatePreview`. Status: genomfört.
2. **Service shares-infrastruktur**: helper + metadata + grundtester. Status: genomfört tekniskt.
3. **Tabellvalidering 2026-09-01**: transkribera exakta andelar och ersätt placeholders. Status: nästa prioritet.
4. **Anläggningsavgift §5**: juridiskt validerade tjänsteandelar, Df utan förbindelsepunkt, moms.
5. **Fastighetstyper §6/§7**: annan + obebyggd med egna andelar och regler.
6. **Tomtytecap**: §5.3 / §7 med separata tester.
7. **Brukningsavgift**: juridiskt validerad V/S/Df/Dg-reduktion.
8. **UI-spårbarhet**: metadata i rader och tydligare visning.
9. **Regression och jämförelse mot 2026-09-01**.

## Risker

- Procentsatstabellerna behöver vara exakt avlästa från skriften innan kodning.
- Nuvarande serviceandelar är placeholders tills `.scratch/va-taxemotor/2026-09-01-regeltabeller.md` finns och tester låser värdena.
- Momsbasen måste definieras noga så moms inte dubbelräknas.
- Tomtytebegränsningen kan påverkas av flera avgiftskomponenter och bör därför inte ligga som enkel cap direkt i raden.
- Livefelet kan maskera regelmotorfel; live/save-paritet är därför redan bruten ut och ska fortsätta skyddas med regressionstest.

## Definition of Done

- `npm run test:unit` passerar.
- `npm run test:e2e` passerar eller har uppdaterade snapshots/assertions.
- Liveförhandsvisning och sparad beräkning matchar för samma input.
- `.scratch/va-taxemotor/2026-09-01-regeltabeller.md` dokumenterar alla använda andelar.
- Alla andelar i `service-shares.ts` är juridiskt spårbara till skriften.
- Inga placeholderandelar eller tysta fallbackvärden finns kvar i regelmotorn.
- Alla listade avvikelser har minst ett regressionstest.
- Avgiftsrader visar regelspår, paragraf, underlag och eventuell reducering.
