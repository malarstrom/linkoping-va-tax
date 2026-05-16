# Linköping VA-taxemotor

En AI-genererad beräkningsmotor för **Taxa för Linköping kommuns allmänna vatten- och avloppsanläggning**.

Källtaxa: [Taxeföreskrifter och priser från 1 september 2026](https://www.tekniskaverken.se/siteassets/tekniska-verken/vatten-och-avlopp/taxeforeskrifter-och-priser-fran-1-september-2026.pdf), publicerad av Tekniska verken.

## Viktig ansvarsfriskrivning

Detta är ett fristående, AI-genererat hjälpmedel. Projektet är **inte** en officiell tjänst från Linköpings kommun eller Tekniska verken.

Beräkningar kan innehålla fel, förenklingar eller feltolkningar av taxeföreskrifterna. Använd därför alltid den officiella taxan och ansvarig huvudman som slutlig källa vid beslut, fakturering eller juridisk bedömning.

## Vad appen gör

Appen hjälper dig att utforska hur VA-taxan kan slå för en viss fastighet. Du kan ange fastighetstyp, tomtyta, bostadsenheter och vilka vattentjänster som är aktuella. Appen visar sedan en beräkning med avgiftsrader, paragrafhänvisningar, reduceringar och moms.

## Local first

Appen är byggd enligt principen **local first**. Det betyder att beräkningar, fastighetsprofiler och sparade arbetsytor hanteras i din egen webbläsare på din egen enhet.

Ingen information om fastigheter, scenarier eller beräkningar skickas till någon server av appen. När du sparar, importerar eller exporterar data sker det lokalt i webbläsaren och i filer som du själv hanterar.

Det gör appen lämplig för känsliga arbetsutkast, men innebär också att du själv ansvarar för att exportera eller säkerhetskopiera uppgifter som du vill behålla.

## Så använder du appen

### 1. Välj eller skapa fastighet

Börja med att välja den aktiva fastigheten. Du kan också skapa en ny fastighet om du vill göra en separat beräkning.

Ange sedan grunduppgifter:

- namn på fastigheten
- fastighetstyp
- tomtyta
- antal bostadsenheter
- aktuella vattentjänster

Vattentjänsterna är:

- **V** – vatten
- **S** – spillvatten
- **Df** – dagvatten fastighet
- **Dg** – dagvatten gata/allmän platsmark

### 2. Välj taxeversion

Välj den taxeversion som ska användas. För denna motor är huvudspåret taxan som gäller från **1 september 2026**.

### 3. Granska liveförhandsvisningen

När du ändrar fastighetsuppgifter eller tjänster räknas resultatet om direkt i liveförhandsvisningen.

Liveförhandsvisningen visar:

- totalbelopp
- anläggningsavgifter
- brukningsavgifter
- moms
- särskilda åtgärder om sådana valts
- vilka regler/paragrafer som använts

### 4. Justera beräkningsscenarier

Du kan ange scenariouppgifter för exempelvis:

- delad förbindelsepunkt
- samfällighetsreduktion
- tillkommande servisledningar
- tillkommande tomtyta
- tillkommande bostadsenheter
- Df utan upprättad förbindelsepunkt
- debiteringsintervall för brukningsavgift
- uppskattad vattenförbrukning
- mätartyp
- särskilda åtgärder
- dröjsmålsdagar

### 5. Spara en beräkning

När beräkningen ser ut som du vill kan du spara den. En sparad beräkning fungerar som en ögonblicksbild av:

- fastighetsprofilen
- taxeversionen
- scenarioinställningarna
- beräkningsresultatet

Det gör att du kan gå tillbaka och jämföra tidigare beräkningar.

### 6. Granska avgiftsraderna

Varje avgiftsrad visar vad beloppet avser. Titta särskilt på:

- beskrivning av avgiften
- paragrafhänvisning
- beräkningsunderlag
- beräknat belopp
- debiterat belopp
- eventuell reducering eller begränsning

Det är här du kan se varför ett belopp inte alltid motsvarar 100 % av grundpriset.

### 7. Gör manuella justeringar vid behov

Om du behöver markera en manuell avvikelse kan du justera en avgiftsrad. Då krävs en motivering. Justeringen sparas i beräkningens historik så att det går att se vad som ändrats och varför.

### 8. Exportera och importera arbetsutrymme

Du kan exportera arbetsutrymmet till JSON för att spara eller flytta dina fastigheter och beräkningar. Importfunktionen kan sedan läsa in filen igen och hantera konflikter med befintliga uppgifter.

## Tolkning av resultat

Appens resultat ska ses som ett beräkningsstöd, inte som ett beslut. Kontrollera alltid resultatet mot den officiella taxeföreskriften, särskilt vid:

- faktisk debitering
- myndighetsutövning
- juridisk bedömning
- ovanliga fastighetsförhållanden
- specialfall enligt taxan

## Feedback och felrapporter

Feedback tas gärna emot via GitHub Issues:

<https://github.com/malarstrom/linkoping-va-tax/issues>

Skapa gärna ett ärende om du hittar något som kan förbättras, till exempel:

- misstänkt fel i en beräkning
- fel paragrafhänvisning eller otydlig regelspårning
- belopp som inte verkar stämma med taxeföreskriften
- problem med import/export
- problem med användargränssnittet
- förslag på bättre texter, förklaringar eller handhavande

Undvik helst ärenden som innehåller känsliga personuppgifter, kunduppgifter eller interna fastighetsärenden. Eftersom projektet är local first ska du inte behöva dela verkliga uppgifter för att beskriva ett problem. Använd hellre anonymiserade eller förenklade exempel.

Ett bra issue innehåller gärna:

1. **Kort rubrik** – exempelvis “Tomtyteavgift verkar inte begränsas enligt §5.3”.
2. **Vad du gjorde** – vilka val du gjorde i appen.
3. **Vad du förväntade dig** – gärna med hänvisning till paragraf eller sida i taxan.
4. **Vad som hände i stället** – belopp, rad eller felmeddelande.
5. **Exempeldata** – anonymiserad tomtyta, tjänsteval, fastighetstyp och scenario.
6. **Skärmbild** – om det hjälper, men ta bort känslig information först.
