/**
 * Mechanische verificatie van twee dingen die rechtstreeks in dossierbestanden
 * schrijven, en dus goed moeten zijn voordat er een knop bij komt:
 *
 *   1. Een taak weggooien: de regel uit werklijst.md en de "## Taak N"-sectie
 *      uit toelichting.md. Alle andere taken moeten letterlijk blijven staan,
 *      inclusief hun nummers (die staan in mails, in developer.md en in
 *      Cowork-gesprekken).
 *   2. cockpit-weergave.md: de volgorde en de korte naam van klanten. Dit
 *      bestand is van de cockpit zelf, maar het staat wel in Drive tussen de
 *      dossiers, dus het moet leesbaar blijven en niets kwijtraken.
 *
 * Draai met: npx tsx test-fixtures/verify-weggooien-en-volgorde.ts
 */
import {
  parseWerklijst,
  nieuweTaakNummer,
  toelichtingVoor,
  toelichtingZonderTaak,
  werklijstZonderTaak,
} from "../lib/werklijst";
import {
  metNieuweVolgorde,
  weergaveNaarMarkdown,
  weergaveUitMarkdown,
} from "../lib/weergave";

let fails = 0;
function ok(naam: string, waar: boolean, uitleg?: string) {
  console.log((waar ? "OK   " : "FOUT ") + naam + (waar || !uitleg ? "" : "\n       " + uitleg));
  if (!waar) fails++;
}

const WERKLIJST = `# Werklijst

Wat er open staat.

| # | Taak | Stap | Status | Datum |
|---|---|---|---|---|
| 1 | Eerste taak | Techniek | open | 2026-09-01 |
| 2 | Tweede taak | Content | bezig | 2026-09-02 |
| 3 | Derde taak | Techniek | klaar | 2026-09-03 |

Een regel onder de tabel die moet blijven staan.
`;

const TOELICHTING = `# Toelichting per taak

## Taak 1
**In het kort**

De eerste.

## Taak 2
**In het kort**

De tweede, met een [link](https://pingwin.nl/).

## Taak 3
**In het kort**

De derde.
`;

console.log("--- 1. Een taak weggooien ---");

const zonder2 = werklijstZonderTaak(WERKLIJST, 2);
ok("de regel van taak 2 is weg", !!zonder2 && !/Tweede taak/.test(zonder2));
ok(
  "taak 1 en 3 staan er nog, met hun eigen nummer",
  !!zonder2 &&
    parseWerklijst(zonder2).map((t) => `${t.n}:${t.titel}`).join(", ") ===
      "1:Eerste taak, 3:Derde taak",
  zonder2 ? parseWerklijst(zonder2).map((t) => `${t.n}:${t.titel}`).join(", ") : "",
);
ok("de tekst rondom de tabel blijft staan", !!zonder2 && zonder2.includes("Een regel onder de tabel"));
ok("de kop van de tabel blijft staan", !!zonder2 && zonder2.includes("| # | Taak | Stap | Status | Datum |"));
ok("een taak die er niet is levert null op", werklijstZonderTaak(WERKLIJST, 99) === null);
ok("een bestand zonder tabel levert null op", werklijstZonderTaak("Gewoon tekst.", 1) === null);

const tZonder2 = toelichtingZonderTaak(TOELICHTING, 2);
ok("de toelichting van taak 2 is weg", !/De tweede/.test(tZonder2));
ok("de toelichting van taak 1 staat er nog", toelichtingVoor(tZonder2, 1).includes("De eerste."));
ok("de toelichting van taak 3 staat er nog", toelichtingVoor(tZonder2, 3).includes("De derde."));
ok("de kop van het bestand blijft staan", tZonder2.startsWith("# Toelichting per taak"));
ok("er blijven geen drie lege regels achter", !/\n\n\n/.test(tZonder2));
ok(
  "een taak zonder toelichting verandert niets",
  toelichtingZonderTaak(TOELICHTING, 99) === TOELICHTING,
);

// De laatste taak weggooien geeft zijn nummer weer vrij; dan mag de
// toelichting van die taak er niet meer staan, anders erft de volgende
// nieuwe taak die tekst.
const zonder3 = werklijstZonderTaak(WERKLIJST, 3)!;
ok("na het weggooien van de laatste taak is het volgende nummer weer 3", nieuweTaakNummer(zonder3) === 3);
ok(
  "en staat er geen oude toelichting meer onder dat nummer",
  toelichtingVoor(toelichtingZonderTaak(TOELICHTING, 3), 3) === "",
);

console.log("\n--- 2. cockpit-weergave.md ---");

const weergaveMd = weergaveNaarMarkdown([
  { klant: "Eerste Kamer Badkamers", korteNaam: "Eerste Kamer", volgorde: null },
  { klant: "Nationaal Oogcentrum", korteNaam: "NOC", volgorde: 2 },
]);
const terug = weergaveUitMarkdown(weergaveMd);
ok("wat je schrijft lees je ook weer terug", terug.length === 2);
ok("de korte naam blijft staan", terug[0].korteNaam === "Eerste Kamer" && terug[1].korteNaam === "NOC");
ok("een lege volgorde blijft leeg", terug[0].volgorde === null);
ok("een ingevulde volgorde blijft een getal", terug[1].volgorde === 2);
ok("de uitleg boven de tabel staat er ook in", weergaveMd.includes("KLANTEN.md"));
ok("een leeg of onbekend bestand levert een lege lijst op", weergaveUitMarkdown("") .length === 0);
ok("tekst zonder tabel levert een lege lijst op", weergaveUitMarkdown("# Iets anders\n\nGeen tabel.").length === 0);

const nieuw = metNieuweVolgorde(terug, ["Nationaal Oogcentrum", "Eerste Kamer Badkamers"]);
ok(
  "een nieuwe volgorde telt vanaf 1",
  nieuw.find((r) => r.klant === "Nationaal Oogcentrum")?.volgorde === 1 &&
    nieuw.find((r) => r.klant === "Eerste Kamer Badkamers")?.volgorde === 2,
);
ok(
  "en laat de korte namen met rust",
  nieuw.find((r) => r.klant === "Nationaal Oogcentrum")?.korteNaam === "NOC",
);
const metVreemde = metNieuweVolgorde(
  [{ klant: "Kamsteeg", korteNaam: "", volgorde: 7 }, ...terug],
  ["Nationaal Oogcentrum"],
);
ok(
  "klanten uit een andere groep blijven ongemoeid",
  metVreemde.find((r) => r.klant === "Kamsteeg")?.volgorde === 7,
);
ok(
  "een klant die nog niet in het bestand stond komt erbij",
  metNieuweVolgorde([], ["Nieuwe Klant"]).length === 1,
);

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} mislukt.`);
process.exit(fails ? 1 : 0);
