/**
 * Mechanische verificatie van de Onboarding-tab: de koppelingentabel uit
 * toegang.md, en het omzetten van "van toepassing".
 *
 * De fixture is de ECHTE toegang.md van Eerste Kamer Badkamers, op 11-09-2026
 * uit Drive gehaald. Dat is met opzet: de vorige versie van dit tabblad ging
 * uit van een tabel met de kolom "Bron", en dit bestand heeft "Koppeling".
 * Gevolg was dat de complete tabel van deze klant nergens op het scherm
 * stond. Een verzonnen fixture had dat nooit aan het licht gebracht.
 *
 * Draai met: npx tsx --conditions=react-server test-fixtures/verify-onboarding.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  koppelStanden,
  koppelingVanToepassingWisselen,
  restVanToegang,
  searchConsoleSoort,
  standKlasse,
  standNaar,
} from "../lib/onboarding";
import { ONBOARDING_STAPPEN, stapUitleg, vulOpdracht } from "../lib/onboarding-ladder";

let fails = 0;
function ok(naam: string, waar: boolean, uitleg?: string) {
  console.log((waar ? "OK   " : "FOUT ") + naam + (waar || !uitleg ? "" : "\n       " + uitleg));
  if (!waar) fails++;
}

const md = readFileSync(join(__dirname, "toegang-fixture.md"), "utf-8");
const rijen = koppelStanden(md);

console.log("--- 1. De koppelingentabel wordt gelezen ---");

ok("de acht vaste koppelingen staan er", rijen.length >= 8, String(rijen.length));
const namen = rijen.map((r) => r.naam);
for (const n of [
  "Search Console",
  "Ahrefs",
  "Google Analytics 4",
  "Google Ads",
  "WordPress",
  "Google Bedrijfsprofiel",
  "Microsoft Clarity",
  "Screaming Frog-crawl",
]) {
  ok(`${n} staat in de tabel`, namen.includes(n));
}
ok(
  "een regel die niet bij een vaste koppeling hoort verdwijnt niet",
  namen.includes("Fotodrive"),
  namen.join(", "),
);

const sc = rijen.find((r) => r.naam === "Search Console")!;
ok("Search Console staat op gekoppeld", sc.stand === "gekoppeld", sc.standRuw);
ok("en de details komen mee", sc.details.includes("URL-prefix"), sc.details.slice(0, 60));
ok(
  "en de soort property wordt afgelezen",
  searchConsoleSoort(sc.details) === "alleen URL-prefix",
  searchConsoleSoort(sc.details),
);

const ahrefs = rijen.find((r) => r.naam === "Ahrefs")!;
ok(
  "de nuance in de stand blijft staan zoals in het bestand",
  ahrefs.standRuw === "gekoppeld, robots.txt weer bereikbaar",
  ahrefs.standRuw,
);
ok("maar het bolletje is groen", standKlasse(ahrefs.stand) === "ja");
ok("en de datum uit Sinds komt mee", ahrefs.sinds === "08-09-2026", ahrefs.sinds);

const clarity = rijen.find((r) => r.naam === "Microsoft Clarity")!;
ok("Clarity staat op niet van toepassing", clarity.stand === "niet van toepassing", clarity.standRuw);

console.log("\n--- 2. De stand teruggebracht tot vijf woorden ---");
ok("leeg is niet gevraagd", standNaar("") === "niet gevraagd");
ok("nvt telt als niet van toepassing", standNaar("nvt") === "niet van toepassing");
ok("een lange gekoppeld-zin blijft gekoppeld", standNaar("gekoppeld, maar half") === "gekoppeld");
ok("ontbreekt", standNaar("ontbreekt nog") === "ontbreekt");
ok("deels", standNaar("deels gekoppeld") === "deels");
ok(
  "een onbekende tekst gokt niet, maar zegt niet gevraagd",
  standNaar("toegang bekend, nog niet gekoppeld aan Windsor") === "niet gevraagd",
);

console.log("\n--- 3. De rest van toegang.md blijft in beeld ---");
const rest = restVanToegang(md);
const koppen = rest.map((r) => r.kop);
for (const k of ["Geschiedenis", "robots.txt bereikbaar", "Openstaand", "Wat hiervan naar de klant moet"]) {
  ok(`sectie "${k}" komt mee`, koppen.includes(k), koppen.join(" | "));
}

console.log("\n--- 4. Van toepassing omzetten raakt één cel ---");
const uit = koppelingVanToepassingWisselen(md, "Google Ads", false, "11-09-2026");
ok("de omzetting lukt", uit !== null);
if (uit) {
  const na = koppelStanden(uit);
  const ads = na.find((r) => r.naam === "Google Ads")!;
  ok("Google Ads staat nu op niet van toepassing", ads.stand === "niet van toepassing", ads.standRuw);
  ok("met de datum van vandaag", ads.sinds === "11-09-2026", ads.sinds);
  ok(
    "de details van die regel blijven staan",
    ads.details.includes("pingwinadwordsmcc@gmail.com"),
    ads.details.slice(0, 50),
  );
  const anderRegels = (t: string) =>
    t.split("\n").filter((r) => r.startsWith("|") && !r.startsWith("| Google Ads"));
  ok(
    "geen enkele andere regel verandert",
    JSON.stringify(anderRegels(uit)) === JSON.stringify(anderRegels(md)),
  );
  ok(
    "en de rest van het bestand ook niet",
    uit.slice(uit.indexOf("## Geschiedenis")) === md.slice(md.indexOf("## Geschiedenis")),
  );
  const terug = koppelingVanToepassingWisselen(uit, "Google Ads", true, "12-09-2026");
  const adsTerug = koppelStanden(terug ?? "").find((r) => r.naam === "Google Ads")!;
  ok("terugzetten geeft niet gevraagd", adsTerug.stand === "niet gevraagd", adsTerug.standRuw);
}
ok(
  "een naam die niet in de tabel staat levert null op, geen stille schade",
  koppelingVanToepassingWisselen(md, "Bestaat Niet", false, "11-09-2026") === null,
);

console.log("\n--- 4b. Een kolomstreep in de details overleeft het omzetten ---");
/**
 * Deze check bestaat omdat het de eerste keer misging: het uitlezen van een
 * regel maakt van `\\|` een gewone streep, en bij het terugschrijven brak die
 * de tabel in tweeën. Aan de code was dat niet te zien, aan het bestand pas
 * nadat je één keer op een vinkje had geklikt.
 */
const metStreep = [
  "| Koppeling | Stand | Sinds | Details |",
  "|---|---|---|---|",
  "| Google Ads | gekoppeld | 01-01-2026 | Kolom A \\| kolom B |",
  "| Ahrefs | gekoppeld | | Niets bijzonders |",
].join("\n");
const naStreep = koppelingVanToepassingWisselen(metStreep, "Google Ads", false, "11-09-2026") ?? "";
const rijenStreep = koppelStanden(naStreep);
ok("de tabel valt niet uit elkaar", rijenStreep.length >= 8, String(rijenStreep.length));
ok(
  "en de streep staat nog in de details",
  (rijenStreep.find((r) => r.naam === "Google Ads")?.details ?? "") === "Kolom A | kolom B",
  rijenStreep.find((r) => r.naam === "Google Ads")?.details,
);
ok(
  "de regel eronder is nog een eigen regel",
  (rijenStreep.find((r) => r.naam === "Ahrefs")?.details ?? "") === "Niets bijzonders",
  rijenStreep.find((r) => r.naam === "Ahrefs")?.details,
);

console.log("\n--- 5. De vaste ladderteksten ---");
ok("tien stappen", ONBOARDING_STAPPEN.length === 10, String(ONBOARDING_STAPPEN.length));
ok(
  "de codes kloppen met het dossier",
  ONBOARDING_STAPPEN.map((s) => s.code).join(",") === "1a,1b,1c,1d,1e,1f,2,3a,3b,3c",
  ONBOARDING_STAPPEN.map((s) => s.code).join(","),
);
ok(
  "de uitleg wordt op de code gevonden, niet op de volgorde",
  stapUitleg("3b Roadmap afgemaakt: wat we met elke pagina willen", 0).code === "3b",
);
ok(
  "zonder code valt hij terug op de plek in de lijst",
  stapUitleg("zomaar een regel", 2).code === "1c",
);
ok(
  "{k} en {domein} worden ingevuld",
  vulOpdracht("Voor {k} op {domein}", "Eerste Kamer", "eerstekamerbadkamers.nl") ===
    "Voor Eerste Kamer op eerstekamerbadkamers.nl",
);
ok(
  "zonder domein valt hij terug op de naam",
  vulOpdracht("{domein}", "Eerste Kamer", "") === "Eerste Kamer",
);

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} mislukt.`);
process.exit(fails ? 1 : 0);
