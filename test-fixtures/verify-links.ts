/**
 * Mechanische verificatie van lib/links.ts: de titel bij een geplakte link.
 *
 * Getest zonder netwerk: het ophalen zelf is één fetch, maar het uitlezen van
 * de titel en de vraag wélke adressen we überhaupt ophalen zijn de stukken
 * waar iets fout kan gaan, en die staan hier los.
 *
 * Draai met: npx tsx --conditions=react-server test-fixtures/verify-links.ts
 *
 * Die conditie is nodig omdat lib/links.ts "server-only" importeert; zonder
 * de vlag gooit dat pakket meteen en draait er geen enkele check.
 */
import {
  magOpgehaaldWorden,
  resolveDriveLinksInText,
  titelUitHtml,
  titelVanLink,
  titelVanLinkMetReden,
  uitlegBijReden,
  vergeetTitels,
} from "../lib/links";

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

async function claudeEnUitleg() {
  console.log("\n--- 4. Links waar nooit een titel uit komt ---");

  /**
   * Gemeten op 11-09-2026 met de twee links die Maarten plakte: claude.ai
   * geeft een anonieme opvraging een 403 van Cloudflare, en
   * docs.google.com een 401. Uit allebei kwam dus niets, en op het scherm
   * bleef alleen de kale url staan. Deze checks leggen vast dat een
   * Claude-link nu een naam heeft, en dat een mislukte opzoeking altijd een
   * zin oplevert die zegt wat eraan te doen is.
   */
  const cowork = await titelVanLinkMetReden(
    "https://claude.ai/cowork/cse_016yAgMh1DLz7b1tKzae5FZ8",
  );
  ok(
    'een Cowork-link heet "Cowork-gesprek"',
    cowork.titel === "Cowork-gesprek" && cowork.reden === "gevonden",
    JSON.stringify(cowork),
  );

  const gesprek = await titelVanLink("https://claude.ai/chat/1234-abcd");
  ok('een Claude-chatlink heet "Claude-gesprek"', gesprek === "Claude-gesprek", String(gesprek));

  ok(
    "een gevonden titel geeft geen uitleg",
    uitlegBijReden("gevonden") === null,
  );
  for (const reden of ["geen-drive-toegang", "inloggen-nodig", "niet-bereikbaar", "geen-titel"] as const) {
    const zin = uitlegBijReden(reden);
    ok(
      `"${reden}" levert een leesbare zin op`,
      typeof zin === "string" && zin.length > 20,
      String(zin),
    );
  }
  ok(
    "de uitleg bij een niet-gedeeld document noemt het delen",
    /deel/i.test(uitlegBijReden("geen-drive-toegang") ?? ""),
    String(uitlegBijReden("geen-drive-toegang")),
  );
}

/**
 * Het geheugen en het naast elkaar opzoeken (12-09-2026). Beide zijn er omdat
 * typen in een taak met een paar kale links merkbaar traag werd: de toelichting
 * slaat zichzelf een seconde na je laatste toetsaanslag op, en bij élke opslag
 * ging hij opnieuw langs álle links.
 *
 * Geen echt netwerk: fetch wordt hier vervangen door een telraam dat ook nog
 * een halve seconde doet alsof het traag is, zodat "naast elkaar" ook echt te
 * meten valt in plaats van te beweren.
 */
async function geheugenEnTempo() {
  console.log("\n--- 5. Niet twee keer hetzelfde opzoeken ---");

  const echteFetch = globalThis.fetch;
  let opgehaald = 0;
  const traagheidMs = 500;
  globalThis.fetch = (async (adres: string | URL | Request) => {
    opgehaald++;
    await new Promise((klaar) => setTimeout(klaar, traagheidMs));
    const naam = String(adres);
    return new Response(`<title>Titel van ${new URL(naam).pathname}</title>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as typeof fetch;

  try {
    vergeetTitels();
    const eerste = await titelVanLink("https://voorbeeld.nl/een");
    const tweede = await titelVanLink("https://voorbeeld.nl/een");
    ok("dezelfde titel komt er de tweede keer ook uit", eerste === tweede, String(tweede));
    ok("maar er is maar één keer opgehaald", opgehaald === 1, `${opgehaald} keer`);

    const vers = await titelVanLink("https://voorbeeld.nl/een", { opnieuw: true });
    ok("plakken kijkt wél opnieuw", opgehaald === 2 && vers === eerste, `${opgehaald} keer`);

    // Een mislukte opzoeking mag net zo goed niet elke opslag opnieuw.
    vergeetTitels();
    opgehaald = 0;
    globalThis.fetch = (async () => {
      opgehaald++;
      await new Promise((klaar) => setTimeout(klaar, traagheidMs));
      return new Response("nee", { status: 403 });
    }) as typeof fetch;
    const mis1 = await titelVanLinkMetReden("https://voorbeeld.nl/dicht");
    const mis2 = await titelVanLinkMetReden("https://voorbeeld.nl/dicht");
    ok(
      "een mislukte opzoeking wordt onthouden, mét zijn reden",
      opgehaald === 1 && mis1.reden === "inloggen-nodig" && mis2.reden === "inloggen-nodig",
      `${opgehaald} keer, ${mis1.reden}/${mis2.reden}`,
    );

    // Vier verschillende trage links in één tekst: naast elkaar, niet erachter.
    vergeetTitels();
    opgehaald = 0;
    globalThis.fetch = (async (adres: string | URL | Request) => {
      opgehaald++;
      await new Promise((klaar) => setTimeout(klaar, traagheidMs));
      return new Response(`<title>T${new URL(String(adres)).pathname}</title>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch;
    const tekst = [
      "https://voorbeeld.nl/a",
      "https://voorbeeld.nl/b",
      "https://voorbeeld.nl/c",
      "https://voorbeeld.nl/d",
    ].join("\n");
    const begonnen = Date.now();
    const uit = await resolveDriveLinksInText(tekst);
    const duurde = Date.now() - begonnen;
    ok("alle vier de links kregen een titel", (uit.match(/\[T\//g) ?? []).length === 4, uit);
    ok("alle vier zijn opgehaald", opgehaald === 4, `${opgehaald} keer`);
    ok(
      `vier trage links kosten één wachttijd, geen vier (${duurde} ms)`,
      duurde < traagheidMs * 2,
      `${duurde} ms, achter elkaar zou ${traagheidMs * 4} ms zijn`,
    );

    // En de tweede opslag van diezelfde tekst haalt niets meer op.
    opgehaald = 0;
    const nogmaals = Date.now();
    await resolveDriveLinksInText(tekst);
    ok(
      "een tweede opslag van dezelfde tekst haalt niets meer op",
      opgehaald === 0 && Date.now() - nogmaals < traagheidMs,
      `${opgehaald} keer`,
    );

    // Een tekst die al helemaal opgelost is kost sowieso niets.
    opgehaald = 0;
    vergeetTitels();
    await resolveDriveLinksInText("[Een naam](https://voorbeeld.nl/x) en [Twee](https://voorbeeld.nl/y)");
    ok("een tekst met alleen al-benoemde links haalt niets op", opgehaald === 0, `${opgehaald} keer`);
  } finally {
    globalThis.fetch = echteFetch;
    vergeetTitels();
  }
}

void bekendeBronnen()
  .then(claudeEnUitleg)
  .then(geheugenEnTempo)
  .then(() => {
    console.log(fails === 0 ? "\nAlle checks geslaagd." : `\n${fails} mislukt.`);
    process.exit(fails ? 1 : 0);
  });
