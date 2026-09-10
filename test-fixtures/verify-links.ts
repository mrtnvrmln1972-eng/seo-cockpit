/**
 * Mechanische verificatie van lib/links.ts: de titel bij een geplakte link.
 *
 * Getest zonder netwerk: het ophalen zelf is één fetch, maar het uitlezen van
 * de titel en de vraag wélke adressen we überhaupt ophalen zijn de stukken
 * waar iets fout kan gaan, en die staan hier los.
 *
 * Draai met: npx tsx test-fixtures/verify-links.ts
 */
import { magOpgehaaldWorden, titelUitHtml, titelVanLink } from "../lib/links";

let fails = 0;
function ok(naam: string, waar: boolean, uitleg?: string) {
  console.log((waar ? "OK   " : "FOUT ") + naam + (waar || !uitleg ? "" : "\n       " + uitleg));
  if (!waar) fails++;
}

console.log("--- 1. De titel uit een pagina halen ---");

ok(
  "gewone <title>",
  titelUitHtml("<html><head><title>Ooglaseren in Eindhoven</title></head></html>") ===
    "Ooglaseren in Eindhoven",
  String(titelUitHtml("<html><head><title>Ooglaseren in Eindhoven</title></head></html>")),
);
ok(
  "og:title gaat voor op <title>",
  titelUitHtml(
    '<meta property="og:title" content="De echte titel"><title>Iets anders</title>',
  ) === "De echte titel",
);
ok(
  "leestekens en accenten komen goed terug",
  titelUitHtml("<title>Pingwin &amp; co &#8211; gevonden &eacute;n gekozen</title>")?.includes(
    "Pingwin & co",
  ) === true,
  String(titelUitHtml("<title>Pingwin &amp; co &#8211; gevonden &eacute;n gekozen</title>")),
);
ok(
  "een titel over meerdere regels wordt één regel",
  titelUitHtml("<title>\n  Twee regels\n  in de bron\n</title>") === "Twee regels in de bron",
  String(titelUitHtml("<title>\n  Twee regels\n  in de bron\n</title>")),
);
ok("geen titel levert null op", titelUitHtml("<html><body>niets</body></html>") === null);
ok("lege titel levert null op", titelUitHtml("<title>   </title>") === null);
ok(
  "een absurd lange titel wordt niet gebruikt",
  titelUitHtml(`<title>${"x".repeat(400)}</title>`) === null,
);

console.log("\n--- 2. Welke adressen we ophalen ---");

ok("een gewone https-pagina mag", magOpgehaaldWorden("https://pingwin.nl/diensten/"));
ok("http mag ook", magOpgehaaldWorden("http://voorbeeld.nl/"));
ok("localhost niet", !magOpgehaaldWorden("http://localhost:3000/geheim"));
ok("127.0.0.1 niet", !magOpgehaaldWorden("http://127.0.0.1/geheim"));
ok("het interne netwerk niet", !magOpgehaaldWorden("http://192.168.1.1/"));
ok("10.x niet", !magOpgehaaldWorden("http://10.0.0.5/"));
ok("de metadata-service van een cloudmachine niet", !magOpgehaaldWorden("http://169.254.169.254/"));
ok("file:// niet", !magOpgehaaldWorden("file:///etc/passwd"));
ok("onzin levert false op", !magOpgehaaldWorden("zomaar wat tekst"));

async function bekendeBronnen() {
  console.log("\n--- 3. Bekende bronnen ---");
  const mailtjes = [
    "https://mail.superhuman.com/Maarten@pingwin.nl/thread/AAQkAGI4",
    "https://mail.google.com/mail/u/0/#inbox/FMfcgz",
    "https://outlook.office.com/mail/id/AAQk",
  ];
  for (const url of mailtjes) {
    const naam = await titelVanLink(url);
    ok(`een maillink heet "Mail" (${new URL(url).hostname})`, naam === "Mail", String(naam));
  }
}

void bekendeBronnen().then(() => {
  console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} mislukt.`);
  process.exit(fails ? 1 : 0);
});
