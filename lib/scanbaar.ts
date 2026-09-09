import { renderAlineas, renderCel } from "./markdown";

/**
 * lib/scanbaar.ts — de scanbare weergave van lange dossierteksten.
 *
 * Waarom dit bestaat (09-09-2026, op verzoek): een notities.md van tien
 * kilobyte werd getoond als één lange kolom kopjes, regels en tabellen. Alles
 * stond er correct, maar je moest hem lezen om hem te kunnen overzien. Deze
 * laag herkent een paar patronen die in onze dossierbestanden vanzelf al
 * voorkomen en zet ze om in kaarten en blokken, zodat een lange tekst te
 * scannen is zonder dat iemand een speciale schrijfwijze hoeft te leren.
 *
 * De drie afspraken die hierbij horen:
 *
 *   1. Gewone, consistente markdown is genoeg. Er is GEEN eigen syntax, geen
 *      markering, geen kopje dat je op een bepaalde manier moet typen. Wat we
 *      herkennen is de vorm die er toch al staat: een reeks kopjes op hetzelfde
 *      niveau met elk een kort lijstje eronder, en een los kopje met één zin.
 *   2. Alleen bij een flinke hoeveelheid tekst. Een korte notitie blijft
 *      precies zoals hij was; zie MINIMUM_TEKENS.
 *   3. Niets mag kapot. Alles wat niet in een patroon past gaat ongewijzigd
 *      door renderAlineas(), dezelfde weergave als voorheen. Tabellen,
 *      codeblokken en uitklappers blijven dus zoals ze waren.
 *
 * Let op de grens met "een dashboard mag tonen, nooit oordelen" (CLAUDE.md):
 * de kleur en het icoontje van een kaart zijn weergave, geen waardering. Er
 * wordt niets gerangschikt, niets naar voren gehaald en niets belangrijker
 * gemaakt dan de schrijver het opschreef; de volgorde van de tekst blijft
 * exact de volgorde van het bestand.
 */

/** Onder deze lengte blijft een tekst gewoon lopende tekst, zoals hij was. */
const MINIMUM_TEKENS = 1200;

/** Zoveel kopjes op een rij moeten er minstens zijn voordat het kaarten worden. */
const MINIMUM_KAARTEN = 3;

/** Een lijstje langer dan dit is geen kaart meer maar een opsomming. */
const MAX_PUNTEN_OP_KAART = 16;

/** Zo lang mag het zinnetje van een losse mededeling hoogstens zijn. */
const MAX_TEKENS_MELDING = 320;

/** Minstens zoveel kopsecties (## ...) voordat we er kaarten van maken. */
const MINIMUM_SECTIES = 2;

/**
 * De kleuraccenten die de cockpit al heeft (zie :root in app/globals.css).
 * We lopen ze in vaste volgorde af, zodat dezelfde tekst er elke keer
 * hetzelfde uitziet en een kaart nooit ineens van kleur wisselt.
 */
const KLEUREN = ["oranje", "blauw", "groen", "roze", "geel", "rood"] as const;

/**
 * Het icoontje wordt gekozen op een woord in het kopje zelf. Puur weergave:
 * staat er geen van deze woorden in, dan krijgt het kopje het standaardicoon
 * en verandert er verder niets aan de tekst.
 */
const ICONEN: Array<[RegExp, string]> = [
  [/\b(home|homepage|merkpagina|voorpagina)\b/i, "🏠"],
  [/\b(dienst|diensten|dienstenpagina)/i, "🧰"],
  [/\b(locatie|plaats|plaatsen|stad|steden|lokaal|lokale|regio|vestiging)/i, "📍"],
  [/\b(project|projecten|portfolio|referentie)/i, "🗂️"],
  [/\b(startprompt|prompt|instructie|opdracht)/i, "✍️"],
  [/\b(console|cijfers|meting|metingen|posities|vertoningen|klikken|analytics|statistiek|uitgangspositie)/i, "📊"],
  [/\b(prioriteit|prioriteiten|volgorde|planning|roadmap|fasering|stappen)/i, "✅"],
  [/\b(zoekterm|zoektermen|zoekwoord|zoekwoorden|keyword|keywords)/i, "🔎"],
  [/\b(techniek|technisch|snelheid|indexatie|crawl|redirect)/i, "⚙️"],
  [/\b(link|links|linkbuilding|autoriteit|backlink|backlinks)/i, "🔗"],
  [/\b(mail|mails|e-mail|contact|bericht|berichten)/i, "✉️"],
  [/\b(klant|klanten|doelgroep|persona|publiek)/i, "👤"],
  [/\b(tekst|teksten|content|copy|blog|artikel|artikelen)/i, "📝"],
  [/\b(risico|risico's|aandacht|uitzondering|ontbreekt|openstaand|nog geen|let op)/i, "⚠️"],
];

/** Icoon voor een kopje waar geen van de woorden hierboven in staat. */
const STANDAARD_ICOON = "📌";

/** Icoon van een losse mededeling; altijd hetzelfde, zodat je hem herkent. */
const MELDING_ICOON = "💡";

function icoonVoor(titel: string): string {
  for (const [woorden, icoon] of ICONEN) if (woorden.test(titel)) return icoon;
  return STANDAARD_ICOON;
}

function kleurVoor(volgnummer: number): string {
  return KLEUREN[volgnummer % KLEUREN.length];
}

/** Een kopregel: "## Kop", "### Kop" of een regel die helemaal vet is. */
interface Kop {
  niveau: number;
  titel: string;
}

/**
 * Een regel die helemaal uit vette tekst bestaat ("**Locatiepagina's**") telt
 * als kopje. Onze dossierbestanden gebruiken die vorm door elkaar met echte
 * kopjes, en voor de lezer is het hetzelfde: een titeltje boven een stukje.
 * Niveau 9 houdt hem netjes onder de echte kopniveaus.
 */
const VET_NIVEAU = 9;

function leesKop(regel: string): Kop | null {
  const hekjes = /^(#{1,4})\s+(.+?)\s*$/.exec(regel);
  if (hekjes) return { niveau: hekjes[1].length, titel: hekjes[2] };
  const vet = /^\*\*([^*]+)\*\*$/.exec(regel.trim());
  if (vet) return { niveau: VET_NIVEAU, titel: vet[1].trim() };
  return null;
}

/** Splitst tekst in regels en houdt bij waar een codeblok begint en eindigt. */
function regelsMetHek(bron: string): Array<{ tekst: string; inHek: boolean }> {
  let inHek = false;
  return bron.split("\n").map((tekst) => {
    if (/^\s*```/.test(tekst)) {
      inHek = !inHek;
      // De hekregel zelf hoort bij het codeblok, zowel de open- als de sluitregel.
      return { tekst, inHek: true };
    }
    return { tekst, inHek };
  });
}

interface Sectie {
  titel: string | null;
  regels: string[];
}

/** Knipt de tekst in stukken op elke "## Kop"; alles ervoor is het voorwoord. */
function splitsInSecties(bron: string): Sectie[] {
  const secties: Sectie[] = [{ titel: null, regels: [] }];
  for (const { tekst, inHek } of regelsMetHek(bron)) {
    const kop = inHek ? null : leesKop(tekst);
    if (kop && kop.niveau === 2) {
      secties.push({ titel: kop.titel, regels: [] });
      continue;
    }
    secties[secties.length - 1].regels.push(tekst);
  }
  return secties.filter((s) => s.titel !== null || s.regels.join("").trim() !== "");
}

type Vorm = "lijst" | "zin" | "leeg" | "anders";

interface Eenheid {
  kop: Kop | null;
  /** De regels onder het kopje, zonder de kopregel zelf. */
  inhoud: string[];
  /** Alles bij elkaar, precies zoals het in het bestand stond. */
  ruw: string[];
  vorm: Vorm;
}

/** Knipt een stuk tekst in kopje-met-inhoud, en zegt van elk stuk wat het is. */
function splitsInEenheden(regels: string[]): Eenheid[] {
  const eenheden: Eenheid[] = [];
  let huidig: Eenheid | null = null;
  const bewaar = () => {
    if (huidig && (huidig.kop || huidig.ruw.join("").trim() !== "")) {
      huidig.vorm = bepaalVorm(huidig.inhoud);
      eenheden.push(huidig);
    }
  };
  for (const { tekst, inHek } of regelsMetHek(regels.join("\n"))) {
    const kop = inHek ? null : leesKop(tekst);
    if (kop) {
      bewaar();
      huidig = { kop, inhoud: [], ruw: [tekst], vorm: "leeg" };
      continue;
    }
    if (!huidig) huidig = { kop: null, inhoud: [], ruw: [], vorm: "anders" };
    huidig.inhoud.push(tekst);
    huidig.ruw.push(tekst);
  }
  bewaar();
  return eenheden;
}

function bepaalVorm(inhoud: string[]): Vorm {
  const regels = inhoud.map((r) => r.trim()).filter((r) => r !== "");
  if (regels.length === 0) return "leeg";
  const alleenBullets = regels.every((r) => /^[-*]\s+\S/.test(r));
  if (alleenBullets) return regels.length <= MAX_PUNTEN_OP_KAART ? "lijst" : "anders";
  const geenOpmaak = regels.every(
    (r) => !/^[-*]\s|^\d+\.\s|^\||^```|^<details|^<summary|^>/.test(r),
  );
  if (geenOpmaak && regels.join(" ").length <= MAX_TEKENS_MELDING) return "zin";
  return "anders";
}

/** De opeenvolgende kopjes met een kort lijstje eronder, als kaartenrij. */
function isKaartkandidaat(e: Eenheid): boolean {
  return e.kop !== null && e.vorm === "lijst";
}

/**
 * Een losse mededeling: een vet kopje met één kort stukje tekst eronder, dat
 * niet in een rij met soortgenoten staat. Precies de vorm van bijvoorbeeld
 * "**Nog geen pagina: LuxxOut**" met één zin eronder.
 */
function isMelding(eenheden: Eenheid[], i: number): boolean {
  const e = eenheden[i];
  if (!e.kop || e.kop.niveau !== VET_NIVEAU || e.vorm !== "zin") return false;
  const buur = (j: number) => {
    const b = eenheden[j];
    return !!b && b.kop?.niveau === VET_NIVEAU && b.vorm === "zin";
  };
  return !buur(i - 1) && !buur(i + 1);
}

function kaart(titel: string, inhoudHtml: string, volgnummer: number): string {
  const kleur = kleurVoor(volgnummer);
  return (
    `<section class="scankaart k-${kleur}">` +
    `<div class="scankaartkop"><span class="scanicoon" aria-hidden="true">${icoonVoor(titel)}</span>` +
    `<span class="scankaarttitel">${renderCel(titel)}</span></div>` +
    `<div class="scankaartbody">${inhoudHtml}</div>` +
    `</section>`
  );
}

function melding(titel: string, tekst: string): string {
  return (
    `<aside class="scanmelding k-geel">` +
    `<span class="scanicoon" aria-hidden="true">${MELDING_ICOON}</span>` +
    `<div class="scanmeldingtekst"><strong>${renderCel(titel)}</strong> ${renderCel(tekst)}</div>` +
    `</aside>`
  );
}

/**
 * De binnenkant van een sectie (of van de hele tekst als er geen secties zijn):
 * kaartenrijen en losse mededelingen eruit halen, de rest onaangeroerd door de
 * gewone weergave heen laten lopen.
 */
function renderBinnenkant(regels: string[]): string {
  const eenheden = splitsInEenheden(regels);
  const uit: string[] = [];
  let rest: string[] = [];
  const spoelRest = () => {
    if (rest.join("").trim() !== "") uit.push(renderAlineas(rest.join("\n")));
    rest = [];
  };

  let i = 0;
  while (i < eenheden.length) {
    const e = eenheden[i];
    // Een reeks kopjes op hetzelfde niveau, elk met een kort lijstje eronder.
    if (isKaartkandidaat(e)) {
      let eind = i + 1;
      while (
        eind < eenheden.length &&
        isKaartkandidaat(eenheden[eind]) &&
        eenheden[eind].kop!.niveau === e.kop!.niveau
      ) {
        eind++;
      }
      if (eind - i >= MINIMUM_KAARTEN) {
        spoelRest();
        const kaarten = eenheden
          .slice(i, eind)
          .map((k, n) => kaart(k.kop!.titel, renderAlineas(k.inhoud.join("\n")), n));
        uit.push(`<div class="scankaarten">${kaarten.join("")}</div>`);
        i = eind;
        continue;
      }
    }
    if (isMelding(eenheden, i)) {
      spoelRest();
      uit.push(
        melding(
          e.kop!.titel,
          e.inhoud
            .map((r) => r.trim())
            .filter(Boolean)
            .join(" "),
        ),
      );
      i++;
      continue;
    }
    rest.push(...e.ruw);
    i++;
  }
  spoelRest();
  return uit.join("\n");
}

function sectie(titel: string, inhoudHtml: string, volgnummer: number): string {
  const kleur = kleurVoor(volgnummer);
  return (
    `<section class="scansectie k-${kleur}">` +
    `<div class="scansectiekop"><span class="scanicoon" aria-hidden="true">${icoonVoor(titel)}</span>` +
    `<h4 class="scansectietitel">${renderCel(titel)}</h4></div>` +
    `<div class="scansectiebody">${inhoudHtml}</div>` +
    `</section>`
  );
}

/**
 * De weergave van vrije tekst in de cockpit. Korte tekst gaat één op één naar
 * de bestaande weergave; lange tekst krijgt kaarten waar de vorm van de tekst
 * daar aanleiding toe geeft.
 */
export function renderTekst(tekst: string): string {
  const bron = String(tekst ?? "").replace(/\r/g, "");
  if (bron.trim().length < MINIMUM_TEKENS) return renderAlineas(bron);

  const secties = splitsInSecties(bron);
  const metTitel = secties.filter((s) => s.titel !== null);
  if (metTitel.length < MINIMUM_SECTIES) return renderBinnenkant(bron.split("\n"));

  let n = 0;
  return secties
    .map((s) => {
      const binnen = renderBinnenkant(s.regels);
      if (s.titel === null) return binnen;
      return sectie(s.titel, binnen, n++);
    })
    .filter((h) => h.trim() !== "")
    .join("\n");
}
