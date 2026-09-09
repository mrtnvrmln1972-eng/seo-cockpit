/**
 * Mechanische verificatie van lib/servicepunten-model.ts: parseServicepunten()
 * tegen een fixture die de conventie volgt die serialiseerServicepunten()
 * zelf ook produceert (## <plaats>-secties met een Gegevens-tabel, een
 * Aansluitproces-tabel en een Contactlog-tabel, plus een vaste
 * "## Eenmalig geregeld"-sectie), en een volledige parse -> serialiseer ->
 * parse rondje om te bevestigen dat niets verloren gaat.
 *
 * Draai met: npx tsx test-fixtures/verify-servicepunten.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  ALLE_STAPPEN,
  parseServicepunten,
  serialiseerServicepunten,
  voortgang,
} from "../lib/servicepunten-model";

let fails = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : ` — verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`}`);
  if (!ok) fails++;
}

const md = readFileSync(join(__dirname, "servicepunten-fixture.md"), "utf-8");
const model = parseServicepunten(md);

check("laatstBijgewerkt", model.laatstBijgewerkt, "2026-09-09");
check("aantal vestigingen", model.vestigingen.length, 2);

const eindhoven = model.vestigingen.find((v) => v.plaats === "Eindhoven (Oosterhof)");
check("eindhoven gevonden", !!eindhoven, true);
check("eindhoven id (slugify)", eindhoven?.id, "eindhoven-oosterhof");
check("eindhoven status", eindhoven?.status, "draait");
check("eindhoven adres", eindhoven?.adres, "Elzentlaan 143, 5611 LL Eindhoven");
check("eindhoven contact", eindhoven?.contact, "Kevin (vestigingsmanager) en Stijn van de Ven (optometrist)");
check("eindhoven telefoon", eindhoven?.telefoon, "088 44 88 411");
check("eindhoven prioriteit (leeg -> null)", eindhoven?.prioriteit, null);
check(
  "eindhoven opmerking (escaped pipe teruggelezen)",
  eindhoven?.opmerking,
  "Testregel met een kolom-teken | erin, om escaping te controleren.",
);

check("eindhoven checklist: contact afgevinkt", eindhoven?.checklist["contact"], { afgevinkt: true, datum: "2026-09-06", notitie: "" });
check("eindhoven checklist: login niet afgevinkt", eindhoven?.checklist["login"], { afgevinkt: false, datum: "", notitie: "" });
check("eindhoven checklist: alle 15 stappen aanwezig", Object.keys(eindhoven?.checklist ?? {}).length, ALLE_STAPPEN.length);
check("eindhoven voortgang", eindhoven ? voortgang(eindhoven) : null, { klaar: 4, totaal: 15 });

check("eindhoven contactlog: 1 regel", eindhoven?.contactlog.length, 1);
check("eindhoven contactlog[0].wie", eindhoven?.contactlog[0]?.wie, "Maarten");

const annadal = model.vestigingen.find((v) => v.plaats === "Annadal");
check("annadal gevonden", !!annadal, true);
check("annadal status", annadal?.status, "kandidaat");
check("annadal prioriteit (getal)", annadal?.prioriteit, 9);
check(
  "annadal volgordereden",
  annadal?.volgordereden,
  "50 p/mnd op 'ooglaseren maastricht' (KD 5, makkelijk), tweede punt in Limburg naast Heerlen.",
);
check("annadal checklist: lege tabel -> alle 15 stappen default onafgevinkt", Object.keys(annadal?.checklist ?? {}).length, ALLE_STAPPEN.length);
check("annadal checklist: geen enkele stap afgevinkt", annadal ? voortgang(annadal).klaar : null, 0);
check("annadal contactlog: leeg", annadal?.contactlog.length, 0);

check("eenmaligGeregeld bevat Telefonie-alinea", model.eenmaligGeregeld.includes("Vijf nummers bestaan al"), true);
check("eenmaligGeregeld bevat Vergoeding-alinea", model.eenmaligGeregeld.includes("€150 per uur"), true);

// ---- Rondje: parse -> serialiseer -> parse moet hetzelfde model geven ----
const opnieuw = parseServicepunten(serialiseerServicepunten(model));
check("rondje: zelfde aantal vestigingen", opnieuw.vestigingen.length, model.vestigingen.length);
check("rondje: eindhoven identiek", opnieuw.vestigingen.find((v) => v.id === "eindhoven-oosterhof"), eindhoven);
check("rondje: annadal identiek", opnieuw.vestigingen.find((v) => v.id === "annadal"), annadal);
check("rondje: eenmaligGeregeld identiek", opnieuw.eenmaligGeregeld, model.eenmaligGeregeld);

// ---- Mutatie: een stap afvinken en opnieuw serialiseren/parsen ----
if (eindhoven) {
  eindhoven.checklist["login"] = { afgevinkt: true, datum: "2026-09-09", notitie: "" };
  eindhoven.contactlog.push({ datum: "2026-09-09", wie: "Tonny", tekst: "Testregel met een | teken erin." });
  const bijgewerkt = parseServicepunten(serialiseerServicepunten(model));
  const eindhoven2 = bijgewerkt.vestigingen.find((v) => v.id === "eindhoven-oosterhof");
  check("mutatie: login nu afgevinkt", eindhoven2?.checklist["login"], { afgevinkt: true, datum: "2026-09-09", notitie: "" });
  check("mutatie: contactlog nu 2 regels", eindhoven2?.contactlog.length, 2);
  check(
    "mutatie: nieuwe logregel met pipe-teken correct teruggelezen",
    eindhoven2?.contactlog.find((l) => l.wie === "Tonny")?.tekst,
    "Testregel met een | teken erin.",
  );
}

// ---- Opmerking per stap en "Let op" als eigen blok (09-09-2026) ----------
// Beide moeten volle markdown aankunnen (opsomming, link, vet) en dus in een
// eigen blok staan in plaats van in een tabelcel, zodat een Cowork-gesprek ze
// net zo goed kan vullen als dit scherm.
if (eindhoven) {
  const notitie = "- Profiel staat live: [Google-bedrijfsprofiel](https://maps.google.com/?cid=1)\n- **Nog doen**: foto's toevoegen";
  const letOp = "Draait sinds 27-08-2026.\n\n- Twee handleidingen liggen bij Stijn\n- Eigen SEO-pagina staat nog niet live";
  eindhoven.checklist["gmb"] = { afgevinkt: true, datum: "2026-09-09", notitie };
  eindhoven.opmerking = letOp;
  const tekst = serialiseerServicepunten(model);
  check("notitie krijgt een eigen #### blok", tekst.includes("#### " + ALLE_STAPPEN.find((s) => s.id === "gmb")!.label), true);
  check('"Let op" krijgt een eigen ### blok', tekst.includes("### Let op"), true);
  check('"Let op" staat niet meer als tabelcel', /\| Opmerking \|/.test(tekst), false);

  const na = parseServicepunten(tekst).vestigingen.find((v) => v.id === "eindhoven-oosterhof");
  check("notitie komt ongewijzigd terug, met opsomming en link", na?.checklist["gmb"]?.notitie, notitie);
  check("het vinkje en de datum blijven staan", na?.checklist["gmb"]?.afgevinkt, true);
  check('"Let op" komt ongewijzigd terug, met witregel en opsomming', na?.opmerking, letOp);
  check("een stap zonder opmerking blijft leeg", na?.checklist["telefoon"]?.notitie, "");
  check("de andere stappen blijven kloppen", na?.checklist["contact"]?.afgevinkt, true);
  check("het contactlog blijft staan", na?.contactlog.length, 2);
}

// Een bestand van vóór deze wijziging (Opmerking in de gegevenstabel) moet
// gewoon blijven werken: het staat straks nog in Drive.
const oudeVorm = `# Servicepunten

Laatst bijgewerkt: 2026-09-01

## Ergens

| Veld | Waarde |
|---|---|
| Status | draait |
| Opmerking | Oude vorm, uit de tabelcel. |

### Aansluitproces

| Stap | Afgevinkt | Datum |
|---|---|---|

### Contactlog

| Datum | Wie | Wat |
|---|---|---|

## Eenmalig geregeld

Niets.
`;
check(
  "oude bestandsvorm: opmerking uit de tabelcel wordt nog gelezen",
  parseServicepunten(oudeVorm).vestigingen[0]?.opmerking,
  "Oude vorm, uit de tabelcel.",
);

console.log(fails === 0 ? `\nAlle checks geslaagd.` : `\n${fails} check(s) mislukt.`);
process.exit(fails === 0 ? 0 : 1);
