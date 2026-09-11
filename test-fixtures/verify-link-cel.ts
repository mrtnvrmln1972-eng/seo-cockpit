/**
 * Mechanische verificatie van lib/link-cel.ts: het adres uit een dossiercel
 * lezen, in de twee vormen waarin het daar staat.
 *
 * Waarom dit apart getest wordt: op deze functie hangt of het adres in het
 * vestigingsoverzicht een échte klikbare link wordt. Leest hij `[Titel](url)`
 * verkeerd, dan komt er een kapotte href in beeld en gaat een klik nergens
 * heen; dat is precies wat Maarten op 11-09-2026 meldde, alleen dan om een
 * andere reden.
 *
 * Draai met: npx tsx test-fixtures/verify-link-cel.ts
 */
import { korteUrl, leesLinkCel } from "../lib/link-cel";

let fails = 0;
function ok(naam: string, waar: boolean, uitleg?: string) {
  console.log((waar ? "OK   " : "FOUT ") + naam + (waar || !uitleg ? "" : "\n       " + uitleg));
  if (!waar) fails++;
}

console.log("--- Een cel lezen ---");

const kaal = leesLinkCel("https://www.laatjeogenlaseren.nl/vooronderzoek-bij-oogwereld-emmen/");
ok(
  "een kale url wordt een link",
  kaal.url === "https://www.laatjeogenlaseren.nl/vooronderzoek-bij-oogwereld-emmen/",
  JSON.stringify(kaal),
);
ok(
  "en krijgt een leesbaar label zonder https en www",
  kaal.label.startsWith("laatjeogenlaseren.nl/"),
  kaal.label,
);

const metTitel = leesLinkCel("[Vooronderzoek bij Oogwereld Emmen](https://voorbeeld.nl/a)");
ok(
  "een titel-link geeft de url uit de haakjes",
  metTitel.url === "https://voorbeeld.nl/a",
  JSON.stringify(metTitel),
);
ok(
  "en de titel als label",
  metTitel.label === "Vooronderzoek bij Oogwereld Emmen",
  metTitel.label,
);

const leeg = leesLinkCel("   ");
ok("een lege cel geeft geen link", leeg.url === "" && leeg.label === "", JSON.stringify(leeg));

const tekst = leesLinkCel("nog aanvragen bij Novio");
ok(
  "gewone tekst wordt géén link",
  tekst.url === "" && tekst.label === "nog aanvragen bij Novio",
  JSON.stringify(tekst),
);

ok(
  "javascript: is geen link",
  leesLinkCel("javascript:alert(1)").url === "",
  JSON.stringify(leesLinkCel("javascript:alert(1)")),
);

console.log("\n--- Een url leesbaar korten ---");
ok("kort blijft heel", korteUrl("https://pingwin.nl/diensten") === "pingwin.nl/diensten");
ok("een slotstreep gaat eraf", korteUrl("https://pingwin.nl/diensten/") === "pingwin.nl/diensten");
const lang = korteUrl(`https://voorbeeld.nl/${"pad/".repeat(40)}`, 40);
ok("een lang adres wordt ingekort", lang.length <= 41 && lang.includes("…"), lang);

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} mislukt.`);
process.exit(fails ? 1 : 0);
