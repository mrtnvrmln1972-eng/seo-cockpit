import { Marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/**
 * lib/opmaak.ts — de brug tussen de markdown in de dossierbestanden en de
 * opgemaakte tekst in de editor (app/_components/Opmaakveld.tsx).
 *
 * Waarom dit bestand het gevoeligste stuk van de opmaakstrip is: Drive is de
 * enige bron van waarheid (CLAUDE.md) en die bestanden worden ook BUITEN dit
 * dashboard gelezen en geschreven, door Cowork-sessies en door de skills. Een
 * editor die opgemaakte tekst toont, moet bij het opslaan exact dezelfde
 * markdown terugleggen. Doet hij dat niet, dan sloopt hij stilletjes een
 * dossier: een tabel die scheeftrekt, een vinklijst die verdwijnt, een
 * "**Onderdelen**"-blok dat een kop wordt.
 *
 * Daarom staat hier naast de heen- en terugvertaling ook rondlopen(): die
 * vertaalt heen én terug en vergelijkt het resultaat met het origineel. Komt
 * daar niet hetzelfde uit, dan bevat het bestand iets wat wij niet exact
 * kunnen teruggeven en schakelt het veld zichtbaar over naar broncode-modus,
 * in plaats van de gok te wagen. Dat is het vangnet dat op 09-09-2026 met
 * Maarten is afgesproken.
 *
 * Dit bestand is bewust NIET server-only: dezelfde vertaling draait in de
 * browser (de editor) en in test-fixtures/verify-opmaak.ts.
 */

/**
 * Een link die in het bestand als `[tekst](url)` staat en een kale url die
 * markdown zelf al klikbaar maakt, leveren exact dezelfde HTML op. Bij het
 * terugschrijven moet je ze tóch uit elkaar houden, anders verandert er tekst
 * die niemand heeft aangeraakt: van een kale url zou `[url](url)` gemaakt
 * worden, of andersom. Bij vijf links die in het bestand aan elkaar geplakt
 * staan (dat komt voor) liep het helemaal mis: die werden dan één lange,
 * onbruikbare url (gezien in het dossier van Nationaal Oogcentrum, 10-09-2026).
 *
 * Vandaar dit merkteken: marked weet aan de ruwe tekst van het stukje of er
 * blokhaken omheen stonden, en zet dat als data-mdlink op de link. Turndown
 * leest het weer terug. Voor de lezer verandert er niets; het staat alleen in
 * de tussenvorm, nooit in het dossierbestand.
 */
const MDLINK_ATTRIBUUT = "data-mdlink";

const markdownLezer = new Marked({
  renderer: {
    link(this: unknown, token: { href: string; title?: string | null; text: string; raw: string }) {
      const expliciet = token.raw.trimStart().startsWith("[");
      const titel = token.title ? ` title="${token.title.replace(/"/g, "&quot;")}"` : "";
      const merk = expliciet ? ` ${MDLINK_ATTRIBUUT}="1"` : "";
      return `<a href="${token.href.replace(/"/g, "&quot;")}"${titel}${merk}>${token.text}</a>`;
    },
  },
});

/** Onderstrepen bestaat niet in markdown; afgesproken 09-09-2026 dat het als <u> in het bestand komt. */
const ONDERSTREEP_TAG = "u";

let turndownInstantie: TurndownService | null = null;

function turndown(): TurndownService {
  if (turndownInstantie) return turndownInstantie;

  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
    hr: "---",
    // Blanke regels binnen een blok laten staan zoals ze zijn; turndown
    // normaliseert anders witruimte die in een dossierbestand betekenis heeft.
    blankReplacement: (_content, node) =>
      (node as HTMLElement).nodeName === "BR" ? "\n" : "",
  });

  // Tabellen, doorhalen en vinklijsten. Onze dossierbestanden staan er vol
  // mee (werklijst.md is één grote tabel, toelichting.md heeft vinkregels),
  // dus zonder deze uitbreiding is rondlopen() bij vrijwel elk bestand vals.
  td.use(gfm);

  // Onderstrepen: als <u> bewaren in plaats van weggooien.
  td.addRule("onderstrepen", {
    filter: [ONDERSTREEP_TAG],
    replacement: (content) => (content ? `<${ONDERSTREEP_TAG}>${content}</${ONDERSTREEP_TAG}>` : ""),
  });

  // Doorhalen met twee tildes. De gfm-uitbreiding schrijft er één, en dat is
  // in onze bestanden geen doorhaling maar gewoon een tilde.
  td.addRule("doorgehaald", {
    filter: ["del", "s"],
    replacement: (content) => (content ? `~~${content}~~` : ""),
  });

  // Een kale url in lopende tekst blijft kaal. Markdown herkent hem zelf al
  // als link, en onze dossierbestanden staan er vol mee; zonder deze regel
  // maakt turndown er [https://...](https://...) van en verandert dus tekst
  // die niemand heeft aangeraakt.
  td.addRule("kaleUrl", {
    filter: (node) => {
      if (node.nodeName !== "A") return false;
      // Stond hij in het bestand als [tekst](url), dan blijft hij dat.
      if (node.getAttribute(MDLINK_ATTRIBUUT)) return false;
      const href = node.getAttribute("href");
      return !!href && href === (node.textContent ?? "").trim();
    },
    replacement: (_content, node) => (node.textContent ?? "").trim(),
  });

  // De vinklijst uit de editor zet de tekst van een punt in een <div>. Zonder
  // deze regel maakt turndown daar een eigen blok van, met een lege regel
  // eromheen, en staat een vinklijst opeens los uit elkaar in het bestand.
  td.addRule("vinkpuntInhoud", {
    filter: (node) =>
      node.nodeName === "DIV" && (node.parentNode as Element | null)?.nodeName === "LI",
    replacement: (content) => content,
  });

  turndownInstantie = td;
  return td;
}

/**
 * Markdown uit een dossierbestand naar HTML voor de editor.
 *
 * breaks: true is hier geen smaakkwestie maar noodzaak. Onze dossierbestanden
 * breken lopende tekst af rond de tachtig tekens, en met breaks: false plakt
 * marked die regels aan elkaar tot één lange regel. Bij het opslaan zou dan
 * de hele alinea opnieuw afgebroken worden, en dus zou rondlopen() bij vrijwel
 * elk bestand met gewone tekst afgaan; de editor zou nooit meer dan
 * broncode-modus laten zien. Met breaks: true blijft elke regelovergang
 * bestaan zoals de schrijver hem zette, en komt hij er ook weer zo uit.
 */
export function markdownNaarHtml(md: string): string {
  const tekst = String(md ?? "").replace(/\r\n?/g, "\n");
  const html = markdownLezer.parse(tekst, { gfm: true, breaks: true, async: false });
  return typeof html === "string" ? vinklijstenHerkenbaar(html) : "";
}

/**
 * marked schrijft een vinklijst als een gewone <ul> met een <input type=
 * checkbox> in het lijstpunt. De editor kent die vorm niet en maakt er dan
 * doodgewone bulletjes van: de vinkvakjes zijn weg op het scherm, en zodra
 * iemand iets in dat veld typt worden ze ook uit het dossierbestand
 * weggeschreven. Dat is precies het stille dossierverlies dat dit bestand
 * hoort te voorkomen (gevonden op 09-09-2026 door zelf naar het scherm te
 * kijken; het vangnet zag het niet, want dat kijkt langs de editor heen).
 *
 * We zetten er daarom de twee kenmerken bij die de editor wél herkent
 * (data-type op de lijst en op het punt, plus data-checked). Het <input>
 * blijft gewoon staan: de editor negeert hem bij het inlezen, en bij het
 * terugvertalen is hij juist het teken waaraan turndown de vinkregel herkent.
 */
function vinklijstenHerkenbaar(html: string): string {
  if (!/type="checkbox"/.test(html)) return html;
  return html
    .replace(/<ul>(\s*<li>\s*<input\b)/g, '<ul data-type="taskList">$1')
    .replace(/<li>(\s*<input\b([^>]*)>)/g, (heel, punt: string, attrs: string) => {
      if (!/type="checkbox"/.test(attrs)) return heel;
      const aan = /\bchecked\b/.test(attrs);
      return `<li data-type="taskItem" data-checked="${aan}">${punt}`;
    });
}

/**
 * Een scheidingsregel van een tabel, dus een regel die alleen uit |, spaties,
 * streepjes en dubbele punten bestaat en minstens één streepje heeft.
 */
const SCHEIDINGSREGEL = /^\s*\|[\s|:-]*-[\s|:-]*\|\s*$/;

/**
 * Onze dossierbestanden schrijven de scheidingsregel van een tabel compact,
 * dus |---|---|, terwijl turndown er | --- | --- | van maakt. Inhoudelijk
 * hetzelfde (de parsers in lib/markdown.ts trimmen elke cel), maar het zijn
 * andere tekens, en dan zou rondlopen() bij ELK bestand met een tabel afgaan
 * en zou de editor daar nooit opgemaakte tekst kunnen tonen. Daarom schrijven
 * we de scheidingsregel terug in de huisvorm, in plaats van de controle
 * losser te maken: liever de uitvoer laten passen bij wat er al staat dan een
 * verschil door de vingers zien.
 */
function scheidingsregelsCompact(md: string): string {
  return md
    .split("\n")
    .map((regel) => {
      if (!SCHEIDINGSREGEL.test(regel)) return regel;
      const cellen = regel
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      return "|" + cellen.join("|") + "|";
    })
    .join("\n");
}

/**
 * Turndown zet achter een opsommingsteken drie spaties ("-   tekst") en
 * springt een genest niveau met vier spaties in. Onze bestanden gebruiken één
 * spatie en twee spaties. Weer hetzelfde afweging als bij de scheidingsregel
 * hierboven: de uitvoer laten passen bij wat er al staat, in plaats van de
 * controle losser te maken.
 */
function lijstenInHuisvorm(md: string): string {
  return md
    .split("\n")
    .map((regel) => {
      const m = /^(\s*)([-*+]|\d+\.)([ \t]+)(.*)$/.exec(regel);
      if (!m) return regel;
      const [, inspringing, teken, , rest] = m;
      // Turndown springt per niveau vier spaties in, wij twee.
      const niveau = Math.floor(inspringing.replace(/\t/g, "    ").length / 4);
      const nieuweInspringing = "  ".repeat(niveau);
      // Een vinkregel houdt precies één spatie tussen [ ] en de tekst.
      const restNet = rest.replace(/^\[( |x|X)\][ \t]+/, (_a, teken2) => `[${teken2}] `);
      return `${nieuweInspringing}${teken} ${restNet}`;
    })
    .join("\n");
}

/**
 * Turndown zet voor de zekerheid een backslash voor elk teken dat opmaak zou
 * kunnen zijn. Bij twee gevallen is dat overdreven, en dan verandert er tekst
 * die de gebruiker niet heeft aangeraakt:
 *
 *   "2 * 3 * 4"  ->  "2 \* 3 \* 4"
 *   "a_b_c"      ->  "a\_b\_c"
 *
 * Een sterretje met spaties eromheen begint geen vet of cursief, en een
 * liggend streepje midden in een woord ook niet (dat is expliciet zo in de
 * markdown-variant die wij gebruiken). Alleen die twee halen we terug, geen
 * teken meer: elders is de backslash wél nodig.
 */
function onnodigeBackslashesWeg(md: string): string {
  return (
    md
      .replace(/(^|[\s(])\\\*(?=[\s).,;:]|$)/gm, "$1*")
      .replace(/(\w)\\_(?=\w)/g, "$1_")
      .replace(/(\w)\\_(?=\w)/g, "$1_")
      // Blokhaken om een woord ("Vervang alleen [stad]") zijn in onze
      // bestanden gewoon tekst, geen link. Turndown zet er voor de zekerheid
      // een backslash voor, en dan verandert er tekst die niemand heeft
      // aangeraakt. Alleen terugdraaien als er geen "(" achteraan komt: dan
      // zou het wél een link worden.
      .replace(/\\\[([^\]\n]*)\\\](?!\()/g, "[$1]")
  );
}

/**
 * Een lege tabelcel schrijft turndown als twee spaties ("|  |"), onze
 * bestanden als één ("| |"). Zelfde afweging als bij de scheidingsregel: de
 * uitvoer laten passen bij wat er al staat, in plaats van het verschil door de
 * vingers te zien.
 */
function legeTabelcellenCompact(md: string): string {
  return md
    .split("\n")
    .map((regel) => (regel.trim().startsWith("|") ? regel.replace(/\|[ \t]+(?=\|)/g, "| ") : regel))
    .join("\n");
}

/**
 * De editor zet de inhoud van een lijstpunt in een eigen alinea
 * (<li><p>tekst</p></li>). Turndown maakt van elke alinea een blok, en dan
 * komt er een lege regel tussen elk lijstpunt te staan. Onze dossierbestanden
 * schrijven lijsten strak onder elkaar, dus halen we die alinea weg zolang een
 * lijstpunt uit niets anders bestaat dan die ene alinea. Een lijstpunt met
 * meerdere alinea's of een genest lijstje laten we met rust: daar hoort de
 * lege regel juist wel.
 */
function lijstpuntenStrak(html: string): string {
  return html.replace(
    /<li([^>]*)>\s*(<input\b[^>]*>)?\s*(?:<div[^>]*>\s*)?<p>([\s\S]*?)<\/p>\s*(?:<\/div>\s*)?(<\/li>)/g,
    (heel, attrs: string, vinkje: string | undefined, inhoud: string, sluit: string) =>
      /<p>|<ul|<ol|<div/i.test(inhoud) ? heel : `<li${attrs}>${vinkje ?? ""}${inhoud}${sluit}`,
  );
}

/**
 * Nog twee dingen die de editor anders opschrijft dan marked, en die alleen
 * langs de editor te zien zijn (het vangnet kijkt er langs, want dat vertaalt
 * rechtstreeks heen en terug):
 *
 *   1. Een lijstpunt met een lijstje eronder houdt zijn <p>. Zonder ingrijpen
 *      komt er een lege regel tussen elk punt te staan, en trekt een genest
 *      lijstje in het bestand uit elkaar.
 *   2. Een tabel krijgt een <colgroup> mee (van het kolombreedte-mechanisme).
 *      De markdown-vertaling ziet daardoor de koprij niet meer als koprij en
 *      laat de HELE tabel als ruwe HTML in het bestand staan. Dat is precies
 *      het soort stille verminking waar dit bestand voor bedoeld is.
 */
function eersteAlineaLos(html: string): string {
  // De <p> van een lijstpunt of een tabelcel weghalen, maar alleen als er niets
  // in staat wat zelf een blok is. Alleen het paar <p></p> verdwijnt, de rest
  // van de opbouw blijft staan zoals hij stond.
  const zonderBlok = "([^<]*(?:<(?!\\/?(?:p|ul|ol|div|table)\\b)[^>]*>[^<]*)*)";
  return html
    .replace(
      new RegExp(`<li([^>]*)>\\s*(?:<div[^>]*>\\s*)?<p>${zonderBlok}</p>\\s*(?=<ul|<ol)`, "g"),
      (_heel, attrs: string, inhoud: string) => `<li${attrs}>${inhoud}`,
    )
    .replace(
      new RegExp(`<(th|td)([^>]*)>\\s*<p>${zonderBlok}</p>\\s*</\\1>`, "g"),
      (_heel, tag: string, attrs: string, inhoud: string) => `<${tag}${attrs}>${inhoud}</${tag}>`,
    );
}

/** De kolombreedtes van de editor horen niet in een dossierbestand thuis. */
function kolomgroepenWeg(html: string): string {
  return html.replace(/<colgroup[\s\S]*?<\/colgroup>/gi, "");
}

/** HTML uit de editor terug naar markdown voor het dossierbestand. */
export function htmlNaarMarkdown(html: string): string {
  const md = turndown().turndown(
    lijstpuntenStrak(eersteAlineaLos(kolomgroepenWeg(String(html ?? "")))),
  );
  return normaliseerUitvoer(legeTabelcellenCompact(lijstenInHuisvorm(scheidingsregelsCompact(md))));
}

/**
 * Een opsomming mag in markdown direct onder een alinea beginnen, zonder lege
 * regel ertussen. Onze dossierbestanden doen dat volop:
 *
 *   **Locatiepagina's, de lokale kern**
 *   - [/hovenier-oss/](...)
 *
 * De editor geeft dat terug mét een lege regel ertussen, want dat is de vorm
 * die elke markdown-schrijver hanteert. Inhoudelijk is het exact hetzelfde
 * (marked leest beide als een alinea met een lijst eronder), maar het zijn
 * andere tekens, en dus sloeg het vangnet aan bij vrijwel élk bestand met een
 * vetgedrukt kopje boven een lijstje. Gevolg: precies de bestanden waar je het
 * meest in schrijft (notities.md) kwamen alleen als broncode in beeld, zonder
 * opmaakknoppen (gemeld door Maarten, 09-09-2026).
 *
 * Daarom zetten we die lege regel er aan BEIDE kanten van de vergelijking bij,
 * in plaats van het verschil door de vingers te zien. Dat betekent dat een
 * bestand bij het opslaan één lege regel per lijstje erbij kan krijgen. Dat is
 * de enige wijziging die we toestaan, hij is zichtbaar, hij verandert niets
 * aan de betekenis, en hij is precies de vorm die de rest van onze bestanden
 * al gebruikt. Binnen een codeblok gebeurt er niets.
 */
function witregelVoorLijsten(md: string): string {
  const regels = String(md ?? "").split("\n");
  const uit: string[] = [];
  let inHek = false;
  const isLijstregel = (r: string) => /^\s*(?:[-*+]\s|\d+\.\s)/.test(r);
  const isBlokregel = (r: string) =>
    r.trim() === "" || isLijstregel(r) || /^\s*(?:#|>|\||```|<)/.test(r);
  for (let i = 0; i < regels.length; i++) {
    const regel = regels[i];
    const isHekregel = /^\s*```/.test(regel);
    if (isHekregel) inHek = !inHek;
    uit.push(regel);
    const volgende = regels[i + 1];
    if (volgende === undefined) continue;
    // Twee codeblokken die direct op elkaar volgen (een sluitende ``` met
    // meteen daaronder een openende) krijgen er ook een lege regel tussen.
    // Zonder die regel sloeg het vangnet aan bij elke taak met twee blokjes
    // tekst onder elkaar, bijvoorbeeld een title en een metabeschrijving.
    if (isHekregel && !inHek && /^\s*```/.test(volgende)) {
      uit.push("");
      continue;
    }
    if (inHek) continue;
    if (!isBlokregel(regel) && isLijstregel(volgende)) {
      uit.push("");
    }
  }
  return uit.join("\n");
}

/**
 * Een kopregel zonder tekst ("###") levert niets op en verdwijnt bij het
 * terugschrijven. Ze staan in oudere dossierbestanden en zijn de zoveelste
 * reden waarom zo'n bestand alleen als broncode in beeld kwam. Weghalen aan
 * beide kanten van de vergelijking: er gaat geen tekst verloren, want er
 * stond niets.
 */
function legeKoppenWeg(md: string): string {
  return String(md ?? "")
    .split("\n")
    .filter((regel) => !/^\s*#{1,6}\s*$/.test(regel))
    .join("\n");
}

/**
 * Backslashes binnen een webadres horen daar niet. Ze zijn er ooit ingekomen
 * doordat een eerdere versie het liggende streepje in een Drive-id als opmaak
 * las en er een backslash voor zette; bij elke volgende opslag kwam er weer
 * één bij ("1Qx4\\_ZLd" en erger). Een link met zo'n backslash werkt niet
 * meer, en het bestand kwam alleen nog als broncode in beeld.
 *
 * Nieuwe schade kan niet meer ontstaan (een gewone url met een liggend
 * streepje loopt netjes rond), maar de bestanden waar het al in staat moeten
 * er ook weer uit kunnen komen. Daarom halen we die backslashes weg aan beide
 * kanten van de vergelijking: het veld toont dan gewoon opgemaakte tekst, en
 * zodra je iets opslaat is het adres in het dossier meteen weer heel.
 */
function backslashesInUrlsWeg(md: string): string {
  return String(md ?? "").replace(/https?:\/\/[^\s)<>"]+/g, (url) => url.replace(/\\/g, ""));
}

/**
 * Kleine, bewust minimale opschoning van wat turndown teruggeeft: nooit meer
 * dan één lege regel achter elkaar, geen spaties aan het regeleinde, en één
 * afsluitende regelovergang. Meer dan dit normaliseren we niet, want dan zou
 * rondlopen() echte verschillen kunnen wegpoetsen.
 */
function normaliseerUitvoer(md: string): string {
  return witregelVoorLijsten(
    legeKoppenWeg(onnodigeBackslashesWeg(backslashesInUrlsWeg(String(md ?? "")))),
  )
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((r) => r.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n*$/, "\n");
}

/**
 * Dezelfde opschoning op het origineel, zodat rondlopen() niet struikelt over
 * verschillen die niemand ziet en die bij opslaan toch al zouden verdwijnen
 * (een dubbele lege regel, een spatie aan het eind van een regel).
 */
export function normaliseerVoorVergelijking(md: string): string {
  return normaliseerUitvoer(md);
}

export interface RondloopUitkomst {
  /** Kwam er na heen- en terugvertalen exact hetzelfde uit? */
  gelijk: boolean;
  /** De markdown zoals hij eruit zou komen; alleen bedoeld om te vergelijken. */
  terug: string;
  /** Het origineel, op dezelfde manier opgeschoond. */
  origineel: string;
  /** De eerste regel die verschilt, 1-geïndexeerd; null als alles gelijk is. */
  eersteVerschilRegel: number | null;
}

/**
 * Het vangnet. Vertaalt markdown naar HTML en weer terug, en zegt of daar
 * exact hetzelfde uitkomt. Zo niet, dan mag de editor dit veld niet opgemaakt
 * tonen: er zou bij opslaan iets veranderen wat de gebruiker niet heeft
 * aangeraakt.
 */
export function rondlopen(md: string): RondloopUitkomst {
  const origineel = normaliseerVoorVergelijking(md);
  let terug = "";
  try {
    terug = htmlNaarMarkdown(markdownNaarHtml(origineel));
  } catch {
    return { gelijk: false, terug: "", origineel, eersteVerschilRegel: 1 };
  }

  if (terug === origineel) {
    return { gelijk: true, terug, origineel, eersteVerschilRegel: null };
  }

  const a = origineel.split("\n");
  const b = terug.split("\n");
  let regel: number | null = null;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      regel = i + 1;
      break;
    }
  }
  return { gelijk: false, terug, origineel, eersteVerschilRegel: regel };
}

/** Korte versie van rondlopen() voor waar alleen het ja/nee telt. */
export function kanOpgemaaktGetoondWorden(md: string): boolean {
  if (!String(md ?? "").trim()) return true;
  return rondlopen(md).gelijk;
}
