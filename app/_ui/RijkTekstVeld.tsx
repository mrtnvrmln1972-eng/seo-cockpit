"use client";

import { useRef } from "react";

/**
 * app/_ui/RijkTekstVeld.tsx — een simpele opmaakbalk boven een gewoon
 * <textarea>-veld, 08-09-2026 gebouwd op Maartens verzoek om bij het
 * bewerken van een developer-taak dezelfde knoppenbalk te hebben als de
 * oude pingwin-seo-dashboard.vercel.app (B, I, · lijst, 1. lijst, ✓
 * vinklijst, ▾ uitklapper, 🔗 link, link weg, beeld).
 *
 * BEWUSTE AFWIJKING van de oude RijkTekstVeld (app/_velden/RijkTekstVeld.tsx
 * in die andere, oude repo): die is een contentEditable-veld dat rechtstreeks
 * HTML opslaat. Dat past niet bij dit project — CLAUDE.md, "Drive is de
 * enige bron van waarheid": elk dossierbestand hier is markdown met een
 * vaste, beperkte opmaakset die lib/markdown.ts leest en rendert (**vet**,
 * *cursief*, `code`, bullets, genummerde lijsten, vinkjes, links,
 * afbeeldingen, en sinds vandaag ook een <details>/<summary>-uitklapper).
 * Dit veld is dus een gewoon <textarea> met knoppen die markdown-tekens om
 * de selectie heen zetten — geen los HTML-formaat, geen tweede
 * opslagconventie naast de rest van de dossierbestanden.
 *
 * Wat de knoppen doen (allemaal bestaande, al ondersteunde markdown uit
 * lib/markdown.ts): B -> **tekst**, I -> *tekst*, · lijst -> "- " per regel,
 * 1. lijst -> "1. " per regel, ✓ vinklijst -> "- [ ] " per regel, ▾
 * uitklapper -> <details><summary>titel</summary> ... </details> (nieuw
 * vandaag toegevoegd aan renderAlineas(), zie de doc-comment daar), 🔗 link
 * -> [tekst](url) (vraagt de url), link weg -> haalt de []()-opmaak van de
 * selectie af, beeld -> ![alt](url) (vraagt de url).
 */

interface Props {
  waarde: string;
  onChange: (waarde: string) => void;
  placeholder?: string;
  rows?: number;
  naam?: string;
  disabled?: boolean;
}

export default function RijkTekstVeld({ waarde, onChange, placeholder, rows = 5, naam, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function selectie() {
    const el = ref.current;
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
  }

  function zetWaarde(nieuw: string, selStart: number, selEnd: number) {
    onChange(nieuw);
    // De cursor/selectie terugzetten kan pas nadat React de nieuwe waarde
    // heeft gerenderd — zonder de volgende tick zou de browser de oude
    // tekstlengte gebruiken en de selectie op de verkeerde plek zetten.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  /** Zet vaste tekens om de selectie heen (bv. ** voor vet). */
  function omwikkel(voor: string, na: string = voor, placeholderTekst = "tekst") {
    const el = ref.current;
    if (!el) return;
    const { start, end } = selectie();
    const heeftSelectie = end > start;
    const geselecteerd = heeftSelectie ? waarde.slice(start, end) : placeholderTekst;
    const nieuw = waarde.slice(0, start) + voor + geselecteerd + na + waarde.slice(end);
    const nieuweStart = start + voor.length;
    const nieuweEnd = nieuweStart + geselecteerd.length;
    zetWaarde(nieuw, nieuweStart, nieuweEnd);
  }

  /** Zet een vast voorvoegsel voor elke geselecteerde regel (bv. "- " voor een bullet). */
  function regelVoorvoegsel(maakVoorvoegsel: (regelIdx: number) => string) {
    const el = ref.current;
    if (!el) return;
    const { start, end } = selectie();
    // Uitbreiden naar volledige regels, zodat een selectie die halverwege een
    // regel begint/eindigt toch die hele regel meeneemt.
    const regelStart = waarde.lastIndexOf("\n", start - 1) + 1;
    let regelEindZoek = waarde.indexOf("\n", end);
    if (regelEindZoek === -1) regelEindZoek = waarde.length;

    const stuk = waarde.slice(regelStart, regelEindZoek);
    const regels = stuk.split("\n");
    const nieuweRegels = regels.map((r, i) => maakVoorvoegsel(i) + r);
    const vervanging = nieuweRegels.join("\n");
    const nieuw = waarde.slice(0, regelStart) + vervanging + waarde.slice(regelEindZoek);
    zetWaarde(nieuw, regelStart, regelStart + vervanging.length);
  }

  function uitklapper() {
    const titel = window.prompt("Titel van de uitklapper:", "");
    if (titel === null) return;
    const { start, end } = selectie();
    const heeftSelectie = end > start;
    const inhoud = heeftSelectie ? waarde.slice(start, end) : "";
    const blok = `<details>\n<summary>${titel.trim() || "Meer"}</summary>\n\n${inhoud}\n</details>\n`;
    const nieuw = waarde.slice(0, start) + blok + waarde.slice(end);
    const cursor = start + blok.length;
    zetWaarde(nieuw, cursor, cursor);
  }

  function link() {
    const { start, end } = selectie();
    const geselecteerd = waarde.slice(start, end);
    const url = window.prompt("Naar welke url moet de link wijzen?", "https://");
    if (!url || !url.trim()) return;
    const tekst = geselecteerd || window.prompt("Linktekst:", "") || url;
    const stuk = `[${tekst}](${url.trim()})`;
    const nieuw = waarde.slice(0, start) + stuk + waarde.slice(end);
    zetWaarde(nieuw, start, start + stuk.length);
  }

  function linkWeg() {
    const { start, end } = selectie();
    const geselecteerd = waarde.slice(start, end);
    const match = /^\[([^\]]*)\]\([^)]*\)$/.exec(geselecteerd.trim());
    if (!match) return;
    const kaal = match[1];
    const nieuw = waarde.slice(0, start) + kaal + waarde.slice(end);
    zetWaarde(nieuw, start, start + kaal.length);
  }

  function beeld() {
    const url = window.prompt("Url van de afbeelding:", "https://");
    if (!url || !url.trim()) return;
    const alt = window.prompt("Korte omschrijving (mag leeg):", "") || "";
    const { start, end } = selectie();
    const stuk = `![${alt}](${url.trim()})`;
    const nieuw = waarde.slice(0, start) + stuk + waarde.slice(end);
    const cursor = start + stuk.length;
    zetWaarde(nieuw, cursor, cursor);
  }

  return (
    <div className="rijktekstveld">
      <div className="rijktekstbalk">
        <button type="button" className="rtk-btn rtk-b" onClick={() => omwikkel("**")} title="Vet">
          B
        </button>
        <button type="button" className="rtk-btn rtk-i" onClick={() => omwikkel("*")} title="Cursief">
          I
        </button>
        <button
          type="button"
          className="rtk-btn"
          onClick={() => regelVoorvoegsel(() => "- ")}
          title="Lijst met bullets"
        >
          · lijst
        </button>
        <button
          type="button"
          className="rtk-btn"
          onClick={() => regelVoorvoegsel((i) => `${i + 1}. `)}
          title="Genummerde lijst"
        >
          1. lijst
        </button>
        <button
          type="button"
          className="rtk-btn"
          onClick={() => regelVoorvoegsel(() => "- [ ] ")}
          title="Vinklijst"
        >
          ✓ vinklijst
        </button>
        <button type="button" className="rtk-btn" onClick={uitklapper} title="Uitklapper">
          ▾ uitklapper
        </button>
        <button type="button" className="rtk-btn" onClick={link} title="Link">
          🔗 link
        </button>
        <button type="button" className="rtk-btn" onClick={linkWeg} title="Link weghalen">
          link weg
        </button>
        <button type="button" className="rtk-btn" onClick={beeld} title="Afbeelding">
          beeld
        </button>
      </div>
      <textarea
        ref={ref}
        className="rijktekstinvoer"
        name={naam}
        rows={rows}
        placeholder={placeholder}
        value={waarde}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
