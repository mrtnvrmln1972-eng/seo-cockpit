/**
 * Mechanische verificatie van lib/markdown.ts tegen fixtures die de
 * WERKELIJKE structuur van signalen.md en roadmap.md volgen (headers,
 * secties, br/bold/code-opmaak binnen cellen), rechtstreeks overgenomen
 * uit de echte Drive-bestanden van Nationaal Oogcentrum (gefetcht
 * 07-09-2026). Draai met: npx tsx test-fixtures/verify-markdown.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { alleTabelRijen, alleSecties, renderCel } from "../lib/markdown";

let fails = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : ` — verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`}`);
  if (!ok) fails++;
}

// ---- signalen.md ----
const signalen = readFileSync(join(__dirname, "signalen-fixture.md"), "utf-8");
const sigRijen = alleTabelRijen(signalen, "Signaal");
check("signalen: aantal rijen", sigRijen.length, 2);
check("signalen: rij 1 titel", sigRijen[0]["Signaal"], "De tien kliniekpagina's staan op noindex en halen samen 52.685 vertoningen");
check("signalen: rij 1 urgentie", sigRijen[0]["Urgentie"], "hoog");
check("signalen: rij 2 status", sigRijen[1]["Status"], "open");
check(
  "signalen: renderCel zet <br> om en bold/code",
  renderCel("**De situatie**<br><br>Test met `code` erin."),
  "<strong>De situatie</strong><br /><br />Test met <code>code</code> erin.",
);

// ---- roadmap.md ----
const roadmap = readFileSync(join(__dirname, "roadmap-fixture.md"), "utf-8");
const secties = alleSecties(roadmap)
  .map((sec) => ({ ...sec, rijen: alleTabelRijen(sec.inhoud, "Pagina") }))
  .filter((sec) => sec.rijen.length > 0);

check("roadmap: aantal secties met paginatabel", secties.length, 2);
check("roadmap: sectiekoppen", secties.map((s) => s.kop), ["Homepage en hoofdthemas", "Lensimplantatie"]);
check("roadmap: rijen in sectie 1", secties[0].rijen.length, 2);
check("roadmap: rijen in sectie 2", secties[1].rijen.length, 3);
check("roadmap: rij 14 pagina", secties[1].rijen[0]["Pagina"], "`/lensimplantatie/herstel-en-nazorg/`");

// Bug-fix check: "Pagina's die op noindex staan" heeft GEEN #-kolom en moet dus
// worden overgeslagen door alleTabelRijen (spec §6.4, "bij Bogard"-bug).
const alleSectiesRuw = alleSecties(roadmap);
const noindexSectie = alleSectiesRuw.find((s) => s.kop.includes("noindex staan"));
check("roadmap: noindex-sectie gevonden", !!noindexSectie, true);
if (noindexSectie) {
  check("roadmap: noindex-sectie tabel overgeslagen (geen #-kolom)", alleTabelRijen(noindexSectie.inhoud, "Groep").length, 0);
}

// Sectie "Wat er niet in de tabel staat" bevat helemaal geen tabel.
const vrijeSectie = alleSectiesRuw.find((s) => s.kop.startsWith("Wat er niet"));
check("roadmap: vrije-tekstsectie gevonden", !!vrijeSectie, true);
if (vrijeSectie) {
  check("roadmap: vrije-tekstsectie heeft geen paginarijen", alleTabelRijen(vrijeSectie.inhoud, "Pagina").length, 0);
}

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} check(s) gefaald.`);
process.exit(fails === 0 ? 0 : 1);
