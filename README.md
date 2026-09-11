# Pingwin Cockpit

Dit is de nieuwe, lichte webapp-versie van de Pingwin Klantcockpit. In
tegenstelling tot de oude versie (een Claude Artifact) draait deze app op
Vercel en praat hij rechtstreeks met Google Drive, zonder tussenkomst van
Claude. Voordat de app iets kan laten zien, moet jij (Maarten) een paar
dingen zelf instellen. Dat hoef je maar één keer te doen. Hieronder staat
precies wat, stap voor stap.

## Wat je moet doen voordat dit werkt

### Stap 1 — Maak een Google Cloud-project met een service-account

Een "service-account" is een soort robot-account dat namens de app bij Google
Drive mag inloggen, zonder dat er een mens hoeft in te loggen.

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com/) en
   log in met het Google-account waaronder ook de Drive-map "Pingwin Klanten"
   staat (of een account dat daar in ieder geval bij kan).
2. Maak, als je die nog niet hebt, een nieuw project aan (bijvoorbeeld met de
   naam "Pingwin Cockpit"). Dat doe je bovenin via het projectenmenu →
   "Nieuw project".
3. Ga binnen dat project naar **IAM en beheer → Serviceaccounts**.
4. Klik op **Serviceaccount maken**, geef het een herkenbare naam (bijv.
   "pingwin-cockpit-drive") en klik door de stappen heen. Rechten hoef je
   hier niet aan toe te kennen — dat regelen we in stap 4 door de Drive-map
   zelf te delen.
5. Onthoud (of noteer) het e-mailadres van dit service-account. Dat ziet er
   ongeveer zo uit: `pingwin-cockpit-drive@jouw-project.iam.gserviceaccount.com`.
   Dat adres heb je zo bij stap 4 weer nodig.

### Stap 2 — Zet de Google Drive API aan

1. Ga binnen hetzelfde project naar **API's en services → Bibliotheek**.
2. Zoek naar "Google Drive API".
3. Klik erop en klik op **Inschakelen**.

Zonder deze stap mag het service-account wel bestaan, maar mag het nog niets
bij Drive ophalen of wegschrijven.

### Stap 3 — Maak een sleutel (JSON-bestand) voor het service-account

1. Ga terug naar **IAM en beheer → Serviceaccounts** en klik op het
   service-account dat je in stap 1 hebt aangemaakt.
2. Ga naar het tabblad **Sleutels**.
3. Klik op **Sleutel toevoegen → Nieuwe sleutel maken**, kies **JSON**, en
   bevestig.
4. Er wordt automatisch een `.json`-bestand gedownload naar je computer.
   **Bewaar dit bestand goed en deel het met niemand** — wie dit bestand
   heeft, kan namens het service-account bij Drive.

Je hebt dit bestand zo direct nodig in stap 5, dus hou het bij de hand.

### Stap 4 — Deel de map "Pingwin Klanten" met het service-account

1. Open Google Drive en zoek de map **"Pingwin Klanten"** op (dezelfde map
   die de bestaande Klantcockpit-artifact ook gebruikt).
2. Klik met de rechtermuisknop op de map → **Delen**.
3. Plak het e-mailadres van het service-account dat je in stap 1 hebt
   genoteerd (het adres dat eindigt op `.iam.gserviceaccount.com`).
4. Kies de rol:
   - **Kijker (lezen)** is genoeg als de app alleen dingen mag laten zien.
   - Kies **Bewerker (schrijven)** als je ook wilt dat de app dingen kan
     wegschrijven naar Drive (bijvoorbeeld statussen wijzigen, taken
     toevoegen).
5. Klik op **Verzenden/Delen**. Er gaat weliswaar een uitnodigingsmail uit,
   maar die hoeft door niemand geopend te worden — het service-account is een
   robot-account, geen persoon, en krijgt de toegang direct.

### Stap 5 — Vul de omgevingsvariabelen in bij Vercel

Wanneer je deze repository importeert in Vercel (via **New Project → Import
Git Repository**), vraagt Vercel je om omgevingsvariabelen in te stellen
voordat het project gebouwd wordt. Vul daar het volgende in:

| Naam | Wat je erin zet |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | De **hele inhoud** van het JSON-sleutelbestand uit stap 3, als **één regel tekst**. Open het `.json`-bestand in een teksteditor, selecteer alles, kopieer het, en plak het in dit veld. Vercel accepteert de tekst gewoon zoals hij is, ook met alle accolades en aanhalingstekens erin. |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | De map-id van "Pingwin Klanten". Dat is het stuk tekst uit de adresbalk van je browser als je die map in Drive open hebt staan, bijvoorbeeld: `https://drive.google.com/drive/folders/`**`1OE60BWBnTpBpqfJoRfMR6k5tRSAe86kr`** — alleen het vetgedrukte deel (na de laatste `/`) vul je in, niet de hele link. |
| `COCKPIT_WACHTWOORD` | Het wachtwoord waarmee je de cockpit binnenkomt. Verzin er zelf een en zet hem alleen hier; nooit in een bestand in deze repo. Zolang deze variabele leeg is of ontbreekt, kan **iedereen met de link** de hele cockpit lezen, en waarschuwt de app daar bovenaan elke pagina over. |

Na het invullen klik je op **Deploy**. Vercel bouwt en publiceert de app
daarna vanzelf.

### Stap 6 — Geef het service-account leesrechten op Search Console en Analytics

Deze stap is alleen nodig voor het tabblad **Resultaten**; de rest van de
cockpit werkt ook zonder. Het gaat om hetzelfde service-account als hierboven,
dus je hoeft geen tweede account te maken.

1. Ga in Google Cloud naar **API's en services → Bibliotheek** en zet daar twee
   API's aan, op dezelfde manier als de Drive API bij stap 2:
   **Google Search Console API** en **Google Analytics Data API**.
2. Open https://search.google.com/search-console/users, kies bovenin de
   property van de klant, klik op **Gebruiker toevoegen**, plak het adres van
   het service-account (dat eindigt op `.iam.gserviceaccount.com`) en kies
   recht **Beperkt**. Dat recht is genoeg: de cockpit leest alleen.
3. Open https://analytics.google.com/analytics/web/#/a/admin/accounts, ga naar
   **Toegangsbeheer voor property** van diezelfde klant, klik op **+** en geef
   hetzelfde adres de rol **Viewer**.

Herhaal stap 2 en 3 per klant. Het tabblad Resultaten toont het adres van het
service-account zelf op het scherm met dezelfde twee links erbij, dus je hoeft
het nergens op te zoeken: zolang de toegang ontbreekt staat er wat er moet
gebeuren, en zodra hij er is staan de cijfers er vanzelf.

### Wie kan er bij?

Er zijn twee soorten toegang, en ze staan los van elkaar (zie
`lib/toegang.ts`):

1. **De cockpit zelf** (de klantenlijst en alle tabbladen) zit achter het
   wachtwoord uit `COCKPIT_WACHTWOORD`. Eén keer inloggen is genoeg; je blijft
   negentig dagen ingelogd op dat apparaat. Wil je iedereen in één klap
   uitloggen, wijzig dan het wachtwoord in Vercel.
2. **Deelbare links** blijven bewust open, want de lange, onraadbare URL is
   daar zelf de sleutel: het Developerbord (voor de developer) en de
   alleen-lezen servicepuntenpagina van Nationaal Oogcentrum. Op zo'n pagina
   wordt de klantenlijst helemaal niet meegestuurd, dus er lekken daar geen
   namen van andere klanten uit.

### Later een omgevingsvariabele wijzigen

Kom je er later achter dat je een andere Drive-map wilt koppelen, of moet je
een nieuwe sleutel genereren (bijvoorbeeld omdat de oude per ongeluk is
gelekt)? Ga dan in Vercel naar **Project → Settings → Environment
Variables**, werk de waarde bij, en klik daarna op **Redeploy** zodat de
wijziging actief wordt.

## Lokaal draaien (voor ontwikkelaars)

Wil je dit project op je eigen computer draaien om eraan te bouwen?

1. Zorg dat je Node.js hebt geïnstalleerd.
2. Maak een bestand `.env.local` in de root van dit project (dit bestand
   wordt nooit meegecommit, zie `.gitignore`) met dezelfde twee variabelen
   als hierboven:
   ```
   GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account", ...}
   GOOGLE_DRIVE_ROOT_FOLDER_ID=jouw-map-id
   ```
3. Installeer de dependencies: `npm install`
4. Start de ontwikkelserver: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in je browser.

## Architectuur in het kort

- Geen database. Google Drive is en blijft de enige plek waar klantdossiers
  staan.
- De app leest dezelfde mapstructuur en dezelfde markdown-bestanden
  (`werklijst.md`, `roadmap.md`, `signalen.md`, `meta.md`, etc.) als de
  bestaande Klantcockpit-artifact.
- Zie `CLAUDE.md` voor de volledige architectuurregels en de harde eis dat
  dit dashboard alleen toont, nooit zelf oordeelt.
