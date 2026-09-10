/**
 * Mechanische verificatie van lib/opmaak.ts, de brug tussen de markdown in de
 * dossierbestanden en de opgemaakte tekst in de editor.
 *
 * Waarom dit bestand zwaarder is aangezet dan de andere verify-scripts: deze
 * code SCHRIJFT in dossierbestanden die ook buiten het dashboard gelezen
 * worden. Een fout hier is geen lelijk scherm maar een stilletjes veranderd
 * dossier. Er worden dus drie dingen getest:
 *
 *   1. Rondlopen: markdown -> opgemaakt -> markdown moet exact hetzelfde
 *      opleveren, tot op de byte, voor alles wat in onze bestanden voorkomt.
 *   2. Het vangnet: markdown die we NIET exact kunnen teruggeven moet als
 *      zodanig herkend worden, zodat het veld terugvalt op broncode-modus.
 *   3. Het bewerken zelf: opmaak toevoegen aan tekst levert nog steeds geldige
 *      markdown op in de huisvorm.
 *
 * Draai met: npx tsx test-fixtures/verify-opmaak.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { htmlNaarMarkdown, markdownNaarHtml, rondlopen } from "../lib/opmaak";

let fails = 0;

function ok(naam: string, waar: boolean, uitleg?: string) {
  console.log((waar ? "OK   " : "FOUT ") + naam + (waar || !uitleg ? "" : "\n       " + uitleg));
  if (!waar) fails++;
}

/** Loopt rond en meldt het eerste verschil als het misgaat. */
function loopt(naam: string, md: string) {
  const r = rondlopen(md);
  ok(
    naam,
    r.gelijk,
    r.gelijk
      ? undefined
      : `regel ${r.eersteVerschilRegel}\n       was:   ${JSON.stringify(
          r.origineel.split("\n")[(r.eersteVerschilRegel ?? 1) - 1],
        )}\n       wordt: ${JSON.stringify(r.terug.split("\n")[(r.eersteVerschilRegel ?? 1) - 1])}`,
  );
}

/** Moet juist NIET rondlopen: dan hoort het vangnet aan te slaan. */
function vangnetSlaatAan(naam: string, md: string) {
  ok(`vangnet: ${naam}`, !rondlopen(md).gelijk, "dit had als niet-rondlopend herkend moeten worden");
}

console.log("--- 1. Rondlopen op de echte constructies ---");

loopt("het volledige fixture-bestand", readFileSync(join(__dirname, "opmaak-fixture.md"), "utf8"));

loopt("lege tekst", "");
loopt("losse alinea", "Gewoon een zin.\n");
loopt("kop niveau 1", "# Een kop\n");
loopt("kop niveau 2 met taaknummer", "## Taak 12\n");
loopt("kop niveau 3", "### Dieper\n");
loopt("vet", "Een zin met **vet** erin.\n");
loopt("cursief", "Een zin met *cursief* erin.\n");
loopt("vet en cursief door elkaar", "**Vet** en *cursief* en **nog vet**.\n");
loopt("onderstreept als html", "Een zin met <u>onderstreept</u> erin.\n");
loopt("doorgehaald", "Een zin met ~~doorgehaald~~ erin.\n");
loopt("inline code", "Zet `COCKPIT_WACHTWOORD` in Vercel.\n");
loopt("link", "Zie [de cockpit](https://seo-cockpit-eight.vercel.app/).\n");
loopt("kale url in tekst", "Zie https://pingwin.nl/ voor meer.\n");
loopt("opsomming", "- Eerste\n- Tweede\n- Derde\n");
loopt("geneste opsomming", "- Boven\n  - Eronder\n  - Nog een\n- Weer boven\n");
loopt("genummerde lijst", "1. Eerste\n2. Tweede\n3. Derde\n");
loopt("vinklijst", "- [ ] 1a Nog te doen\n- [x] 1b Al gedaan\n");
loopt("vetgedrukte pseudo-kop blijft alinea", "**In het kort**\n\nDe tekst eronder.\n");
loopt("citaat", "> Een citaat uit notities.md.\n");
loopt("horizontale lijn", "Boven\n\n---\n\nOnder\n");
loopt("codeblok", "```\nregel een\nregel twee\n```\n");
loopt(
  "tabel met inhoud",
  "| # | Taak | Status |\n|---|---|---|\n| 1 | Iets doen | open |\n| 2 | Iets anders | klaar |\n",
);
loopt("lege tabel", "| # | Taak |\n|---|---|\n");
loopt(
  "afgebroken alinea behoudt zijn regelovergangen",
  "Dit is een alinea die in het bestand over meerdere regels is\nafgebroken, zoals onze dossierbestanden dat doen, en die zo\nook weer terug moet komen.\n",
);
loopt("sterretje als vermenigvuldiging", "Reken maar: 2 * 3 * 4 is 24.\n");
loopt("liggend streepje midden in een woord", "Het veld heet a_b_c in de export.\n");
loopt("mailoverzicht-regel", "- 08-09-2026 · Pingwin: één zin.\n- 08-09-2026 · Klant: nog een zin.\n");
loopt("accenten en leestekens", "Eén zin mét accenten, ëii, ç, en een emdash-loze opsomming.\n");
loopt(
  "kop, alinea, lijst en tabel achter elkaar",
  "## Taak 3\n\n**Klaar als**\n\n- Punt een\n- Punt twee\n\n| Kop | Waarde |\n|---|---|\n| a | b |\n",
);

// Drie vormen die in onze echte bestanden overal staan en waar het vangnet
// eerst op aansloeg, waardoor juist die bestanden alleen als broncode in beeld
// kwamen (gemeld door Maarten, 09-09-2026).
loopt(
  "vetgedrukt kopje met de lijst er direct onder, zonder witregel",
  "**Locatiepagina's, de lokale kern**\n- [/hovenier-oss/](https://voorbeeld.nl/oss/)\n- [/hovenier-uden/](https://voorbeeld.nl/uden/)\n",
);
loopt(
  "tabel met een lege cel",
  "| Pagina | Term | Positie |\n|---|---|---|\n| /a/ | geen dominante term | |\n",
);
loopt("blokhaken als tekst, geen link", "Vervang alleen [stad] en [dienst].\n");
loopt(
  "het echte notitiebestand van een klant",
  readFileSync(join(__dirname, "scanbaar-fixture.md"), "utf8"),
);

// Vier vormen die in bestaande dossiers staan en die we bij het opslaan
// rechttrekken in plaats van erop af te ketsen. Alle vier zijn ze schade of
// ruis, geen tekst: er gaat niets verloren (09-09-2026).
loopt(
  "twee codeblokken direct achter elkaar",
  "Zet dit live:\n\n```\nTitle: Iets\n```\n```\nMetabeschrijving: Iets anders\n```\n",
);
loopt("een liggend streepje dat ooit is ge-escaped", "Exporteer internal\\_all en images\\_missing\\_alt.\n");
loopt("een kopregel zonder tekst", "**In het kort**\n\n###\n\n**Klaar als**\n");
loopt(
  "een backslash die ooit in een webadres is beland",
  "[Document](https://docs.google.com/document/d/1Qx4Bmbr\\\\_ZLd/edit)\n",
);

// Een link die als [tekst](url) in het bestand staat en een kale url leveren
// dezelfde opgemaakte tekst op; bij het terugschrijven moeten ze toch allebei
// hun eigen vorm houden (10-09-2026, gevonden in het dossier van NOC).
loopt("een kale url blijft kaal", "Zie https://pingwin.nl/ voor meer.\n");
loopt("[url](url) blijft [url](url)", "[https://pingwin.nl/](https://pingwin.nl/)\n");
loopt(
  "drie links die in het bestand aan elkaar geplakt staan",
  "[https://a.nl/x/](https://a.nl/x/)[https://a.nl/y/](https://a.nl/y/)[https://a.nl/z/](https://a.nl/z/)\n",
);
loopt(
  "een link waarvan de tekst een afgekapte url is",
  "[claude.ai/code/artifact/7c389a05…](https://claude.ai/code/artifact/7c389a05-dcbd)\n",
);

loopt(
  "een halve link die ooit is blijven hangen",
  "naam.docx](https://docs.google.com/document/d/1Qx4/edit\n",
);
loopt(
  "blokhaken als tekst op een regel die ook een echte link heeft",
  "Voor [de pagina](https://pingwin.nl/) geldt: vervang alleen [stad].\n",
);

console.log("\n--- 2. Het vangnet slaat aan bij wat we niet exact teruggeven ---");

vangnetSlaatAan("kop in setext-vorm", "Een kop\n=======\n");
vangnetSlaatAan("opsomming met sterretjes", "* Eerste\n* Tweede\n");
vangnetSlaatAan("opsomming met plussen", "+ Eerste\n+ Tweede\n");
vangnetSlaatAan("codeblok met vier spaties inspringing", "    regel code\n    nog een\n");
vangnetSlaatAan("verwijzingslink", "Zie [de site][1].\n\n[1]: https://pingwin.nl/\n");
vangnetSlaatAan("cursief met liggende streepjes", "Een _cursief_ woord.\n");
// Twee lijsten met alleen een witregel ertussen zijn volgens markdown zelf één
// lijst, dus die kunnen we niet als twee teruggeven. Het vangnet hoort dan aan
// te slaan in plaats van de witregel stilletjes te verplaatsen.
vangnetSlaatAan(
  "vinklijst direct gevolgd door een gewone opsomming",
  "- [ ] 1a Nog te doen\n- [x] 1b Al gedaan\n\n- Losse bullet\n- Nog een\n",
);

console.log("\n--- 3. Bewerken levert markdown in de huisvorm op ---");

ok(
  "vet uit de editor wordt **vet**",
  htmlNaarMarkdown("<p>Een <strong>vet</strong> woord.</p>") === "Een **vet** woord.\n",
  JSON.stringify(htmlNaarMarkdown("<p>Een <strong>vet</strong> woord.</p>")),
);
ok(
  "cursief uit de editor wordt *cursief*",
  htmlNaarMarkdown("<p>Een <em>schuin</em> woord.</p>") === "Een *schuin* woord.\n",
  JSON.stringify(htmlNaarMarkdown("<p>Een <em>schuin</em> woord.</p>")),
);
ok(
  "onderstrepen uit de editor blijft <u>",
  htmlNaarMarkdown("<p>Een <u>streep</u> eronder.</p>") === "Een <u>streep</u> eronder.\n",
  JSON.stringify(htmlNaarMarkdown("<p>Een <u>streep</u> eronder.</p>")),
);
ok(
  "opsomming uit de editor krijgt een streepje en een spatie",
  htmlNaarMarkdown("<ul><li>Een</li><li>Twee</li></ul>") === "- Een\n- Twee\n",
  JSON.stringify(htmlNaarMarkdown("<ul><li>Een</li><li>Twee</li></ul>")),
);
ok(
  "genummerde lijst uit de editor telt door",
  htmlNaarMarkdown("<ol><li>Een</li><li>Twee</li></ol>") === "1. Een\n2. Twee\n",
  JSON.stringify(htmlNaarMarkdown("<ol><li>Een</li><li>Twee</li></ol>")),
);
ok(
  "link uit de editor wordt [tekst](url)",
  htmlNaarMarkdown('<p><a href="https://pingwin.nl/">Pingwin</a></p>') ===
    "[Pingwin](https://pingwin.nl/)\n",
  JSON.stringify(htmlNaarMarkdown('<p><a href="https://pingwin.nl/">Pingwin</a></p>')),
);
ok(
  "kop uit de editor wordt ## Kop",
  htmlNaarMarkdown("<h2>Taak 4</h2>") === "## Taak 4\n",
  JSON.stringify(htmlNaarMarkdown("<h2>Taak 4</h2>")),
);
ok(
  "lege editor levert lege tekst op",
  htmlNaarMarkdown("<p></p>").trim() === "",
  JSON.stringify(htmlNaarMarkdown("<p></p>")),
);
ok(
  "markdown naar html geeft echte opmaak terug",
  markdownNaarHtml("**vet**").includes("<strong>"),
  markdownNaarHtml("**vet**"),
);

console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} mislukt.`);
process.exit(fails ? 1 : 0);
