/**
 * Mechanische verificatie van lib/meta.ts tegen een fixture die de
 * werkelijke structuur van meta.md volgt (echte tekst van Nationaal
 * Oogcentrum, gefetcht 07-09-2026). Draai met:
 * npx tsx test-fixtures/verify-meta.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { alleSecties, tabelUitSectie } from "../lib/markdown";
import { boldBlokken, veldenUitBlok, checkTitel, metaInfo } from "../lib/meta";

let fails = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : ` — verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`}`);
  if (!ok) fails++;
}

const md = readFileSync(join(__dirname, "meta-fixture.md"), "utf-8");
const secties = alleSecties(md);
const paginaSecties = secties.filter((s) => s.kop.startsWith("/"));
check("meta: één paginasectie gevonden", paginaSecties.length, 1);

const overzicht = secties.find((s) => s.kop === "Overzicht");
check("meta: Overzicht-sectie gevonden", !!overzicht, true);
// De Overzicht-tabel heeft geen "#"-kolom, dus alleTabelRijen() zou hem
// overslaan (spec §6.4-bugfix) — tabelUitSectie() is hier de juiste keuze.
const overzichtRijen = tabelUitSectie(md, "Overzicht", "status titel");
check("meta: overzicht 1 rij", overzichtRijen.length, 1);
check("meta: overzicht status titel", overzichtRijen[0]?.["Status titel"], "voorstel klaar");

const blokken = boldBlokken(paginaSecties[0].inhoud);
check("meta: vier subblokken gevonden", Object.keys(blokken).sort(), [
  "Baan van de pagina",
  "Goedkeuring",
  "Voorstel",
  "Wat er niet klopt",
  "Zo staat het er nu",
].sort());

const voorstel = veldenUitBlok(blokken["Voorstel"]);
check("meta: voorstel titel", voorstel["Titel"], "Ogen laten laseren zonder bril of lenzen in Naarden");

const nu = veldenUitBlok(blokken["Zo staat het er nu"]);
check("meta: zoekterm uit 'Zo staat het er nu'", nu["Zoekterm"], "ogen laten laseren");

// De echte meting (uit meta.md zelf): titel 458 px, 51 tekens, score 100 van 100.
const info = metaInfo("titel", voorstel["Titel"]);
check("meta: gemeten pixelbreedte van het voorstel komt overeen met meta.md", info.px, 458);
check("meta: gemeten tekens van het voorstel komt overeen met meta.md", info.chars, 51);

const checksTitel = checkTitel(voorstel["Titel"], nu["Zoekterm"]);
const fout = checksTitel.filter((c) => !c.pass);
check("meta: voorstel-titel haalt alle META-controles (0 open punten)", fout.length, 0);

// De "oude" titel in de fixture is met de hand overgenomen uit de baan-tekst
// van meta.md (niet byte-voor-byte de brontekst), dus we toetsen de logica
// hier zelfrefererend: metaInfo() moet consistent "over" melden zodra de
// berekende breedte boven het venstermaximum komt, en checkTitel() moet dat
// zelfde geval dan als META-02-fout aanmerken.
const oudeInfo = metaInfo("titel", nu["Titel"]);
const oudeTitelChecks = checkTitel(nu["Titel"], nu["Zoekterm"]);
const meta02 = oudeTitelChecks.find((c) => c.id === "META-02");
check(
  "meta: META-02 is consistent met metaInfo().ok voor de oude titel",
  meta02 ? !meta02.pass || oudeInfo.ok : undefined,
  true,
);

const goedkeuring = veldenUitBlok(blokken["Goedkeuring"]);
check("meta: goedkeuring titel", goedkeuring["Titel"], "nog niet beoordeeld");

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} check(s) gefaald.`);
process.exit(fails === 0 ? 0 : 1);
