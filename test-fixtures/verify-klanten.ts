/**
 * Mechanische verificatie van lib/klanten.ts tegen een fixture die de
 * werkelijke structuur van KLANTEN.md volgt (echte kop/kolomindeling,
 * gecontroleerd tegen Maartens bestand, 07-09-2026). Draai met:
 * npx tsx test-fixtures/verify-klanten.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { tableWith } from "../lib/markdown";

let fails = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : ` — verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`}`);
  if (!ok) fails++;
}

// Zelfde extractielogica als lib/klanten.ts, hier los getest zodat het geen
// server-only Drive-import nodig heeft.
function rijenUitIndex(md: string) {
  const tabel = tableWith(md, "klant");
  if (!tabel) return [];
  const kolom = (naam: string) => tabel.headers.findIndex((h) => h.trim().toLowerCase() === naam);
  const idxGroep = kolom("groep");
  const idxKlant = kolom("klant");
  const idxDomein = kolom("domein");
  const idxFase = kolom("fase");
  const out: { groep: string; naam: string; domein: string; fase: string }[] = [];
  for (const rij of tabel.rows) {
    const groep = (rij[idxGroep] ?? "").trim().toLowerCase();
    const naam = (rij[idxKlant] ?? "").trim();
    if (!naam || !["eigen", "mc", "lead"].includes(groep)) continue;
    out.push({
      groep,
      naam,
      domein: idxDomein !== -1 ? (rij[idxDomein] ?? "").trim() : "",
      fase: idxFase !== -1 ? (rij[idxFase] ?? "").trim() : "",
    });
  }
  return out;
}

const md = readFileSync(join(__dirname, "klanten-fixture.md"), "utf-8");
const rijen = rijenUitIndex(md);

check("klanten: vijf rijen gevonden", rijen.length, 5);
check("klanten: eerste rij is Kamsteeg in eigen", rijen[0], {
  groep: "eigen",
  naam: "Kamsteeg",
  domein: "kamsteegtuinen.nl",
  fase: "lopend",
});
check("klanten: Pronk staat op fase stil", rijen.find((r) => r.naam === "Pronk")?.fase, "stil");
check("klanten: Kookhuis in groep mc", rijen.find((r) => r.naam === "Kookhuis")?.groep, "mc");
check("klanten: Aquabouw in groep lead", rijen.find((r) => r.naam === "Aquabouw")?.groep, "lead");
check(
  "klanten: Jacobus Toet BV heeft leeg domein maar telt toch mee",
  rijen.find((r) => r.naam === "Jacobus Toet BV")?.domein,
  "",
);
check(
  "klanten: groepstelling eigen=2, mc=1, lead=2",
  [
    rijen.filter((r) => r.groep === "eigen").length,
    rijen.filter((r) => r.groep === "mc").length,
    rijen.filter((r) => r.groep === "lead").length,
  ],
  [2, 1, 2],
);

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} check(s) gefaald.`);
process.exit(fails === 0 ? 0 : 1);
