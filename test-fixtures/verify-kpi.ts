/**
 * Mechanische verificatie van lib/kpi-dossier.ts en de rekenkundige delen van
 * lib/google-data.ts: wat je op de Resultaten-tab vastzet, en welke periode en
 * welke property de cockpit daarbij pakt.
 *
 * Waarom juist dit getest wordt. kpi.md wordt nooit met de hand geschreven maar
 * bij elke ster, elke focus en elke sleep in zijn geheel opnieuw opgeschreven.
 * Gaat er in dat rondje iets verloren, dan is dat aan het scherm niet te zien:
 * je ziet nog steeds een ster staan, alleen staat hij een dag later nergens
 * meer. Vandaar de heen-en-weer-proef, en vandaar de proef dat een eigen kop
 * die wij niet kennen blijft staan.
 *
 * De periode heeft een eigen reden: Search Console loopt twee dagen achter, en
 * een periode die tot vandaag loopt telt dus twee lege dagen mee. Dat is precies
 * het soort fout dat een daling laat zien die er niet is.
 *
 * Draai met: npx tsx --conditions=react-server test-fixtures/verify-kpi.ts
 * (het --conditions-vlaggetje is nodig omdat de libs "server-only" importeren)
 */
import { parseKpi, serialiseerKpi, LEEG_KPI } from "../lib/kpi-dossier";
import { kiesProperty, periodeVan } from "../lib/google-data";

let fails = 0;
function ok(naam: string, waar: boolean, uitleg?: string) {
  console.log((waar ? "OK   " : "FOUT ") + naam + (waar || !uitleg ? "" : "\n       " + uitleg));
  if (!waar) fails++;
}

console.log("--- 1. Een leeg of ontbrekend kpi.md ---");

const leeg = parseKpi("");
ok("een bestand dat er niet is geeft geen fout maar lege voorkeuren",
  Object.keys(leeg.zoekwoorden).length === 0 && leeg.volgorde.length === 0 && leeg.sterren.length === 0);
ok("en geen vastgezette property", leeg.searchConsoleProperty === "" && leeg.ga4Property === "");

console.log("\n--- 2. Lezen wat erin staat ---");

const md = `# KPI

## Instellingen

| Veld | Waarde |
|---|---|
| Search Console-property | sc-domain:eerstekamerbadkamers.nl |
| GA4-property | properties/123456 |

## Zoekwoorden

| Zoekwoord | Focus |
|---|---|
| badkamer renoveren | prio |
| douchecabine op maat | secundair |
| sanitair kopen |  |

## Pagina's

| Pagina | Volgorde | Ster |
|---|---|---|
| https://eerstekamerbadkamers.nl/badkamer-renoveren | 2 | x |
| https://eerstekamerbadkamers.nl/ | 1 |  |
| https://eerstekamerbadkamers.nl/showroom |  | x |

## Eigen aantekening

Deze kop kent de cockpit niet, en hij hoort te blijven staan.
`;

const d = parseKpi(md);
ok("de Search Console-property komt eruit", d.searchConsoleProperty === "sc-domain:eerstekamerbadkamers.nl", d.searchConsoleProperty);
ok("de GA4-property komt eruit", d.ga4Property === "properties/123456", d.ga4Property);
ok("een prio-zoekwoord staat op prio", d.zoekwoorden["badkamer renoveren"] === "prio");
ok("een secundair zoekwoord staat op secundair", d.zoekwoorden["douchecabine op maat"] === "secundair");
ok("een zoekwoord zonder focus telt niet mee", !("sanitair kopen" in d.zoekwoorden));
ok("de volgorde volgt het nummer, niet de regelvolgorde in het bestand",
  d.volgorde[0] === "https://eerstekamerbadkamers.nl/" && d.volgorde[1] === "https://eerstekamerbadkamers.nl/badkamer-renoveren",
  JSON.stringify(d.volgorde));
ok("een pagina zonder nummer staat niet in de volgorde", d.volgorde.length === 2, JSON.stringify(d.volgorde));
ok("de twee sterren staan er, ook die van een pagina zonder nummer",
  d.sterren.includes("https://eerstekamerbadkamers.nl/badkamer-renoveren") &&
    d.sterren.includes("https://eerstekamerbadkamers.nl/showroom"),
  JSON.stringify(d.sterren));

console.log("\n--- 3. Heen en weer: er mag niets verdwijnen ---");

const opnieuw = parseKpi(serialiseerKpi(d));
ok("de property's overleven het opnieuw opschrijven",
  opnieuw.searchConsoleProperty === d.searchConsoleProperty && opnieuw.ga4Property === d.ga4Property);
ok("de zoekwoorden overleven het", JSON.stringify(opnieuw.zoekwoorden) === JSON.stringify(d.zoekwoorden),
  JSON.stringify(opnieuw.zoekwoorden));
ok("de volgorde overleeft het", JSON.stringify(opnieuw.volgorde) === JSON.stringify(d.volgorde),
  JSON.stringify(opnieuw.volgorde));
ok("de sterren overleven het", opnieuw.sterren.length === 2 && d.sterren.every((s) => opnieuw.sterren.includes(s)),
  JSON.stringify(opnieuw.sterren));
ok("een eigen kop blijft staan", serialiseerKpi(d).includes("## Eigen aantekening") &&
  serialiseerKpi(d).includes("Deze kop kent de cockpit niet"));

const metStreep = serialiseerKpi({
  ...LEEG_KPI,
  zoekwoorden: { "badkamer | sanitair": "prio" },
});
ok("een kolomstreep in een zoekwoord breekt de tabel niet", metStreep.includes("badkamer \\| sanitair"), metStreep);
ok("en komt er heel weer uit", parseKpi(metStreep).zoekwoorden["badkamer | sanitair"] === "prio",
  JSON.stringify(parseKpi(metStreep).zoekwoorden));

console.log("\n--- 4. De periode loopt twee dagen achter ---");

const p = periodeVan(28, "prev");
const dagenTussen = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
ok("de huidige periode is 28 dagen lang", dagenTussen(p.curStart, p.curEnd) === 28,
  `${p.curStart} tot ${p.curEnd} = ${dagenTussen(p.curStart, p.curEnd)}`);
ok("de vorige periode is even lang", dagenTussen(p.prevStart, p.prevEnd) === 28,
  `${p.prevStart} tot ${p.prevEnd}`);
ok("het einde ligt twee dagen achter vandaag, want zo ver komt Search Console",
  dagenTussen(p.curEnd, new Date().toISOString().slice(0, 10)) === 3,
  `${p.curEnd} tegenover ${new Date().toISOString().slice(0, 10)}`);
ok("de vorige periode sluit aan op de huidige", dagenTussen(p.prevEnd, p.curStart) === 2,
  `${p.prevEnd} tot ${p.curStart}`);

const jaar = periodeVan(28, "yoy");
ok("bij vorig jaar ligt de vergelijking ruim elf maanden terug",
  dagenTussen(jaar.prevStart, jaar.curStart) >= 364 && dagenTussen(jaar.prevStart, jaar.curStart) <= 367,
  `${jaar.prevStart} tot ${jaar.curStart}`);

console.log("\n--- 5. De juiste property bij een domein ---");

const lijst = [
  "https://www.anderedomein.nl/",
  "sc-domain:eerstekamerbadkamers.nl",
  "https://eerstekamerbadkamers.nl/",
];
ok("een domein-property wint van een url-property",
  kiesProperty(lijst, "eerstekamerbadkamers.nl") === "sc-domain:eerstekamerbadkamers.nl",
  String(kiesProperty(lijst, "eerstekamerbadkamers.nl")));
ok("zonder domein-property pakt hij de url-property",
  kiesProperty(["https://eerstekamerbadkamers.nl/"], "eerstekamerbadkamers.nl") === "https://eerstekamerbadkamers.nl/");
ok("www ervoor maakt niet uit",
  kiesProperty(lijst, "www.eerstekamerbadkamers.nl") === "sc-domain:eerstekamerbadkamers.nl");
ok("een domein waar dit account niet bij mag geeft niets terug, geen gok",
  kiesProperty(lijst, "nogeenanderdomein.nl") === null,
  String(kiesProperty(lijst, "nogeenanderdomein.nl")));
ok("een met de hand vastgezette property wint altijd",
  kiesProperty(lijst, "eerstekamerbadkamers.nl", "sc-domain:iets-anders.nl") === "sc-domain:iets-anders.nl");

console.log(fails === 0 ? "\nAlles goed." : `\n${fails} fout(en).`);
process.exit(fails === 0 ? 0 : 1);
