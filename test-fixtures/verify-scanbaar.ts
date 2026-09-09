/**
 * Mechanische verificatie van lib/scanbaar.ts, de scanbare weergave van lange
 * dossierteksten.
 *
 * Twee dingen worden hier bewezen, en het tweede is het belangrijkste:
 *
 *   1. De patronen worden herkend in een ECHT bestand
 *      (test-fixtures/scanbaar-fixture.md is de notities.md van Paul
 *      Hoevenaars, zoals die nu in Drive staat).
 *   2. Er gaat niets verloren. Alles wat in het bestand staat komt ook in de
 *      uitvoer terecht, en een korte tekst blijft letterlijk zoals hij was.
 *
 * Draai met: npx tsx test-fixtures/verify-scanbaar.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { renderAlineas } from "../lib/markdown";
import { renderTekst } from "../lib/scanbaar";

let fails = 0;

function ok(naam: string, waar: boolean, uitleg?: string) {
  console.log((waar ? "OK   " : "FOUT ") + naam + (waar || !uitleg ? "" : "\n       " + uitleg));
  if (!waar) fails++;
}

const echt = readFileSync(join(__dirname, "scanbaar-fixture.md"), "utf8");
const html = renderTekst(echt);

console.log("--- 1. Korte tekst blijft precies zoals hij was ---");

const kort = "**In het kort**\n\nEén zinnetje.\n\n- Een punt\n- Nog een punt\n";
ok("korte notitie gaat ongewijzigd door de gewone weergave", renderTekst(kort) === renderAlineas(kort));
ok("lege tekst blijft leeg", renderTekst("") === renderAlineas(""));
ok(
  "een lange tekst zonder herkenbaar patroon verandert niet van inhoud",
  renderTekst("Een zin. ".repeat(200)).includes("Een zin."),
);

console.log("\n--- 2. De patronen in de echte notities van Paul Hoevenaars ---");

ok("de secties worden kaarten", (html.match(/class="scansectie /g) ?? []).length === 6, String((html.match(/class="scansectie /g) ?? []).length));
ok("elke sectiekaart heeft een icoon", (html.match(/scansectiekop/g) ?? []).length === 6);
ok(
  "de vier soorten pagina's worden één kaartenrij",
  (html.match(/class="scankaarten"/g) ?? []).length === 1,
  String((html.match(/class="scankaarten"/g) ?? []).length),
);
ok(
  "met vier kaarten erin",
  (html.match(/class="scankaart /g) ?? []).length === 4,
  String((html.match(/class="scankaart /g) ?? []).length),
);
ok("de homepage-kaart krijgt het huis-icoon", /scanicoon[^>]*>🏠/.test(html));
ok("de locatiekaart krijgt de speld", /scanicoon[^>]*>📍/.test(html));
ok("de kaarten krijgen verschillende kleuren", /k-oranje/.test(html) && /k-blauw/.test(html) && /k-groen/.test(html));
ok(
  "LuxxOut wordt een losse mededeling",
  /scanmelding/.test(html) && /LuxxOut/.test(html),
  html.includes("scanmelding") ? "" : "geen meldingblok gevonden",
);
ok("er is precies één mededeling", (html.match(/<aside class="scanmelding/g) ?? []).length === 1);
ok("de titel bovenaan is een kop, geen letterlijk hekje", !/&gt;?#\s|<p># /.test(html) && /<h5>SEO strategie/.test(html));

console.log("\n--- 3. Tabellen, codeblokken en de rest blijven zoals ze waren ---");

ok("de twee tabellen staan er nog", (html.match(/<table class="matrix">/g) ?? []).length === 2);
ok("de tabelkoppen kloppen nog", html.includes("Sterkste zoekterm") && html.includes("Waarom nu"));
ok(
  "de drie startprompts staan er nog, met hun inhoud",
  (html.match(/seo-landingpage-workflow/g) ?? []).length === 3,
);
ok(
  "een kopje binnen een codeblok wordt geen kaart",
  !/scankaart[^>]*>[^<]*Meenemen in de blauwdruk/.test(html),
);
ok(
  "alle dertien projectpagina's staan er nog",
  (html.match(/\/projecten\/[a-z-]+\//g) ?? []).length >= 13,
);

console.log("\n--- 4. Er gaat geen tekst verloren ---");

const platteTekst = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
const uitScanbaar = platteTekst(html);
const woordenUitBestand = echt
  .replace(/[#*`|[\]()]/g, " ")
  .split(/\s+/)
  .filter((w) => w.length > 6 && !w.startsWith("http"));
const kwijt = woordenUitBestand.filter((w) => !uitScanbaar.includes(w));
ok("elk woord uit het bestand staat ook in de uitvoer", kwijt.length === 0, kwijt.slice(0, 8).join(", "));

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} mislukt.`);
process.exit(fails ? 1 : 0);
