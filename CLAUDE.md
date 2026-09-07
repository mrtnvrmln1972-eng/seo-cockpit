# Pingwin Cockpit

Dit project is de Next.js/Vercel-tegenhanger van de bestaande Claude Artifact
**"Pingwin Klantcockpit"** — een SEO-werktool voor Pingwin die klantdossiers
toont en bewerkt. Het doel is dat dit project geleidelijk (tabblad voor
tabblad) de artifact vervangt, met exact hetzelfde gedrag, maar dan als een
losstaande, deelbare webapp in plaats van een Claude Artifact.

## De specificatie is het naslagwerk

Al het gedrag van de bestaande cockpit — datamodel, tabs, kernmechanismen,
business-regels, bekende bugs/fixes — staat gedocumenteerd in
`klantcockpit_specificatie.md` (een blauwdruk-document, 1:1 uit de broncode
van de bestaande artifact gehaald, geen aannames). Dat document is niet in
deze repo meegenomen, maar is de bron waaruit dit project is opgezet. **Elke
nieuwe wijziging of uitbreiding aan dit project moet kloppen met wat daarin
staat.** Twijfel je of iets klopt met het oorspronkelijke gedrag? Ga terug
naar die specificatie (of vraag het aan Maarten) in plaats van zelf iets te
verzinnen dat er "logisch" uitziet.

Kernpunten uit die specificatie die relevant zijn voor elke ontwikkelaar/agent
die hierop verder bouwt:

- **Drie tabbladen, één klant tegelijk**: Roadmap, Signalen, Meta-tool. Elk
  tabblad is een eigen route onder `/klant/[klantslug]/...`. De specificatie
  beschrijft oorspronkelijk vier tabs (Roadmap, Issues, Kansen, Meta-tool,
  met Issues/Kansen elk hun eigen `## Issues`/`## Kansen`-sectie in
  signalen.md). **Dat klopt niet meer met de echte, actuele dossierdata**:
  gecontroleerd tegen de signalen.md van twee live klanten (Nationaal
  Oogcentrum en Eerste Kamer Badkamers, beide bijgewerkt begin september
  2026) bevat geen van beide bestanden nog die koppen — er is één kop
  "# Wat mij is opgevallen" met één ongesplitste tabel. Bij de oude
  Issues/Kansen-splitsing zou dat voor deze klanten een lege tab opleveren.
  Daarom is er nu één "Signalen"-tab die het werkelijke, huidige
  bestandsformaat volgt (zie de doc-comment in
  `app/klant/[klantslug]/signalen/page.tsx`). **Bouw nieuwe functionaliteit
  op dit werkelijke formaat, niet op de Issues/Kansen-splitsing uit de
  oorspronkelijke specificatie.**
- **Dossierbestanden zijn markdown met vaste Nederlandse koppen/kolomnamen**
  (werklijst.md, roadmap.md, signalen.md, meta.md, etc.) — zie `lib/markdown.ts`
  voor de parsers die deze conventies volgen (tabellen matchen op
  koptekst-inhoud, niet op kolomvolgorde; secties onder een `## Kop`; vaste
  statuswaarden open/bezig/bij klant/bij developer/klaar/vervallen/later/
  bevinding).
- **Schrijven volgt het create-then-trash-patroon** uit de bestaande artifact
  (zie de uitgebreide comment in `lib/drive.ts`), inclusief een version gate
  (optimistic locking) vóór elke schrijfactie.

## Architectuurregel: Drive is de enige bron van waarheid

**Er is geen database.** Google Drive (de map "Pingwin Klanten", met
`KLANTEN.md` en per klant een submap met markdown-bestanden) is en blijft de
enige opslaglaag. Dit dashboard leest en schrijft rechtstreeks tegen de Drive
API via een Google service-account (zie `lib/drive.ts`), niet via de
claude.ai MCP-koppeling die de oorspronkelijke artifact gebruikte — die kan
een losstaande Vercel-app niet aanroepen.

Voeg geen database, ORM, of losse opslaglaag toe voor dossierdata. Als iets
"makkelijker met een tabel in een database" zou zijn: dat is een bewust
genomen, al besloten architectuurkeuze om NIET te doen. Structureerde data die
nu als markdown-tabel in een dossierbestand leeft, blijft in dat
dossierbestand leven — de parsers in `lib/markdown.ts` lezen en schrijven
die tabellen, in plaats van dat de data ergens anders wordt gedupliceerd.

## Harde regel: het dashboard toont, het oordeelt nooit

Dit is een expliciete, letterlijke eis van de opdrachtgever (Maarten), en
stond ook al zo — woord voor woord — in de bestaande artifact:

> **"Een dashboard mag tonen, nooit oordelen."**

Concreet betekent dit:

- Geen enkele component, functie of API-route mag zelf een urgentie-,
  prioriteits- of "belangrijkheids"-score berekenen op basis van
  business-logica.
- Een kolom als "urgentie" of "aandacht" mag getoond worden **alleen** als die
  waarde al letterlijk in het dossierbestand staat (dus door een mens is
  ingevuld) — nooit als iets wat de app zelf uitrekent of afleidt.
- Sorteren/filteren op een bestaande, in de data aanwezige waarde mag; een
  eigen gewicht/score toekennen aan rijen (bijv. "deze taak is dringender dan
  die andere") mag niet.
- Bij twijfel: toon de rauwe data uit het dossierbestand, precies zoals die
  daar staat, en laat het oordeel aan de mens (of aan een apart Claude
  Cowork-gesprek, buiten dit dashboard om).

## Structuur van dit project

- `lib/drive.ts` — server-only Google Drive-client (service-account, geen
  gebruikers-OAuth). Lijst/lees/schrijf-functies voor dossierbestanden.
- `lib/markdown.ts` — parsers voor de dossierbestand-conventies (tabellen,
  secties, statuswaarden).
- `lib/klanten.ts` — leest `KLANTEN.md` en geeft de drie klantgroepen
  (Eigen klanten / Leads / Multimedia Concepts) terug.
- `app/layout.tsx` + `app/_components/Nav.tsx` — de linker klantenlijst,
  zichtbaar op elke pagina.
- `app/_components/Tabs.tsx` + `app/klant/[klantslug]/layout.tsx` — de
  tabbalk boven elk klantdossier.
- `app/klant/[klantslug]/{roadmap,signalen,meta}/page.tsx` — de drie
  tabblad-routes, elk in zijn eigen route-map zonder dat ze de routing,
  navigatie of Drive-laag zelf hoeven te verzinnen. Alle drie lezen hun
  dossierbestand via `lib/dossier.ts` en zijn gebouwd tegen echte,
  actuele Drive-data van live klanten (niet alleen tegen de specificatie).
- `lib/meta.ts` — de META-02 t/m META-15-controles (pixelbreedte volgens
  Google's zoekresultaatvenster, zoekwoordpositie, leestekens), 1:1 geport
  uit de oude artifact. Dit zijn objectieve, mechanische controles — geen
  nieuwe eigen beoordeling — dus in lijn met "toont, oordeelt nooit"
  hierboven. Bewust niet geport: de klantstem-toets en het
  doorzetten-naar-de-site-mechanisme (die hebben klantstem.md/toegang.md
  en een schrijf-pad nodig die dit project nog niet heeft).

Zie `README.md` voor de niet-technische installatiestappen die Maarten zelf
moet zetten (service-account aanmaken, map delen, omgevingsvariabelen in
Vercel) voordat dit project daadwerkelijk data toont.
