"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { htmlNaarMarkdown, markdownNaarHtml, rondlopen } from "@/lib/opmaak";
import { titelVanLinkAction } from "./link-acties";

/**
 * De vinklijst zoals hij het bestand weer in gaat. De uitbreiding schrijft van
 * zichzelf <li><label><input><span></label><div>tekst</div></li>, en daar
 * herkent de markdown-vertaling geen vinkregel in: dan zou "- [x] Toegang
 * geregeld" bij het opslaan veranderen in "- Toegang geregeld", en dus stilletjes
 * een vinkje uit een dossier wissen. Met dit ene vervangen komt er
 * <li><input type=checkbox checked>tekst</li> uit, precies de vorm waar
 * lib/opmaak.ts weer "- [x] " van maakt.
 *
 * Dit raakt alleen hoe de tekst wordt weggeschreven; het aanvinken op het
 * scherm loopt via de eigen weergave van de uitbreiding en blijft ongemoeid.
 */
/**
 * De link houdt het merkteken data-mdlink vast dat lib/opmaak.ts erop zet
 * (zie de uitleg daar). Zonder dit raakt de editor het kwijt en zou een link
 * die in het bestand als [tekst](url) staat na een bewerking als kale url
 * worden weggeschreven: dezelfde link, andere tekst in het dossier.
 */
const LinkMetMerk = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-mdlink": {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-mdlink"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes["data-mdlink"] ? { "data-mdlink": attributes["data-mdlink"] } : {},
      },
    };
  },
});

const VinkPunt = TaskItem.extend({
  renderHTML({ node, HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, { "data-type": "taskItem" }),
      ["input", { type: "checkbox", checked: node.attrs.checked ? "checked" : null }],
      ["div", 0],
    ];
  },
});

/**
 * app/_components/Opmaakveld.tsx — één tekstveld met een opmaakstrip, voor
 * overal in de cockpit waar je tekst schrijft die naar een dossierbestand in
 * Drive gaat (de toelichting bij een taak, de notities, "Eenmalig geregeld").
 *
 * Hoe het samenwerkt met de rest van de app: het veld zet zijn markdown in een
 * verborgen invoerveld met de naam die je meegeeft. Elke bestaande server
 * action die de tekst met formData.get("...") ophaalt blijft dus werken zoals
 * hij werkte; er verandert niets aan de schrijfkant.
 *
 * TWEE MODI, en dat is de kern van de afspraak van 09-09-2026:
 *
 * - Opgemaakt. Je ziet vet als vet, geen sterretjes. Dit is de gewone modus.
 * - Broncode. Een gewoon tekstvak met de markdown erin, met een zichtbare
 *   melding erboven. Hier belandt een veld ALLEEN als rondlopen() in
 *   lib/opmaak.ts zegt dat het bestand iets bevat wat wij niet exact kunnen
 *   teruggeven. Liever een lelijker veld dan een dossier dat stilletjes
 *   verandert; Drive is de enige bron van waarheid en die bestanden worden ook
 *   buiten dit dashboard gelezen.
 *
 * Je kunt zelf ook naar broncode schakelen met de knop rechts in de strip, en
 * weer terug. Ook dat gaat langs hetzelfde vangnet.
 *
 * De strip zelf klapt in en uit met het pijltje links, en die stand wordt
 * onthouden. Dat gebeurt bewust met één stuk state en zonder animatie: het
 * knopje mag nooit uit de pas lopen met wat je ziet.
 */

export type OpmaakModus = "opgemaakt" | "bron";

interface Props {
  /** Naam van het formulierveld, precies zoals de server action hem verwacht. */
  naam: string;
  /** De markdown zoals hij nu in het dossierbestand staat. */
  waarde: string;
  /** Tekst in het veld als het leeg is. */
  plaatshouder?: string;
  /** Minimale hoogte van het schrijfvlak in pixels. */
  minHoogte?: number;
  /** Zichtbaar label boven het veld. */
  label?: string;
  /**
   * Voor plekken die de tekst niet via een formulier versturen maar zelf
   * bijhouden (het TaakVenster op het Developerbord). Zonder deze prop gaat
   * de tekst gewoon mee als verborgen formulierveld met de naam hierboven.
   */
  onChange?: (markdown: string) => void;
}

/*
 * De opmaakknoppen stonden hier eerst in een inklapbare strip, met de stand in
 * localStorage. Dat is er 09-09-2026 uit gehaald: één klik op het pijltje
 * verstopte de knoppen op ELK veld in de hele cockpit, en die stand bleef ook
 * na herladen staan. Wie dat per ongeluk deed, zag de opmaakstrip nergens meer
 * en had geen idee waarom. Een strip die je kwijt kunt raken is erger dan een
 * strip die altijd een regel hoog is, dus hij staat er nu gewoon altijd.
 */

/**
 * De plek in de tekst waar deze net geplakte kale url staat. Bewust zoeken in
 * plaats van de positie onthouden die hij bij het plakken had: plak je twee
 * links achter elkaar, dan verschuift de tweede zodra de titel van de eerste
 * binnenkomt, en met een onthouden positie greep de tweede daardoor mis. Er
 * wordt alleen vervangen waar de tekst nog letterlijk die url is, dus wat je
 * zelf hebt getypt of aangepast blijft met rust.
 */
function zoekKaleLink(editor: Editor, url: string): { van: number; tot: number } | null {
  let gevonden: { van: number; tot: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (gevonden || !node.isText || !node.text) return true;
    const index = node.text.indexOf(url);
    if (index === -1) return true;
    gevonden = { van: pos + index, tot: pos + index + url.length };
    return false;
  });
  return gevonden;
}

export default function Opmaakveld({
  naam,
  waarde,
  plaatshouder,
  minHoogte = 180,
  label,
  onChange,
}: Props) {
  /**
   * De uitkomst van het vangnet, één keer bepaald bij de eerste render van
   * deze tekst. Bewust met useMemo op de binnenkomende waarde: als de server
   * na het opslaan verse tekst doorgeeft, wordt hij opnieuw beoordeeld.
   */
  const controle = useMemo(() => rondlopen(waarde), [waarde]);

  const [markdown, zetMarkdownRuw] = useState(waarde);
  // Eén plek waar de tekst verandert, zodat het verborgen veld en een
  // eventuele onChange nooit uit de pas kunnen lopen.
  const meldWijziging = useRef(onChange);
  useEffect(() => {
    meldWijziging.current = onChange;
  }, [onChange]);
  const setMarkdown = useCallback((nieuw: string) => {
    zetMarkdownRuw(nieuw);
    meldWijziging.current?.(nieuw);
  }, []);
  const [modus, setModus] = useState<OpmaakModus>(controle.gelijk ? "opgemaakt" : "bron");
  const [linkVenster, setLinkVenster] = useState(false);
  const [linkAdres, setLinkAdres] = useState("");
  const bronVeld = useRef<HTMLTextAreaElement>(null);
  // Zodat Cmd+K binnen de editor het linkvenster kan openen: de editor wordt
  // één keer opgebouwd, dus hij mag niet aan een functie vastzitten die bij
  // elke render verandert.
  const opentLink = useRef<() => void>(() => {});
  /**
   * De uitleg onder het veld als een geplakte link geen titel opleverde
   * (11-09-2026). Via een ref aangeroepen om dezelfde reden als opentLink: de
   * plak-afhandeling zit vast aan de editor die maar één keer wordt opgebouwd.
   */
  const [linkUitleg, setLinkUitleg] = useState<string | null>(null);
  const meldLinkUitleg = useRef<(tekst: string | null) => void>(() => {});
  useEffect(() => {
    meldLinkUitleg.current = setLinkUitleg;
  }, []);


  // De plak-afhandeling hieronder heeft de editor nodig terwijl hij hem zelf
  // aan het opbouwen is; vandaar een ref in plaats van de variabele zelf.
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        // openOnClick: een klik op een link opent hem gewoon, ook terwijl je in
        // de tekst aan het werk bent (09-09-2026, gemeld door Maarten: "als je
        // nu op een link klikt, dan ga je niet naar de pagina"). Altijd in een
        // nieuw tabblad: in ditzelfde tabblad zou je de cockpit verlaten, en
        // een tekst die net is gewijzigd wordt pas een seconde later opgeslagen.
        LinkMetMerk.configure({
          openOnClick: true,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { target: "_blank", rel: "noreferrer" },
        }),
        TaskList,
        VinkPunt.configure({ nested: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: controle.gelijk ? markdownNaarHtml(waarde) : "",
      editorProps: {
        attributes: {
          class: "opmaakvlak",
          style: `min-height:${minHoogte}px`,
        },
        // Cmd+B, Cmd+I en Cmd+U komen uit de uitbreidingen zelf; Cmd+K niet,
        // die zetten we hier.
        handleKeyDown: (_view, event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            opentLink.current();
            return true;
          }
          return false;
        },
        /**
         * Een geplakte link krijgt de titel van de pagina als linktekst
         * (09-09-2026, op verzoek: "ik wil gewoon de titel zien"). De link
         * verschijnt meteen, met de url als tekst; zodra de titel binnen is
         * wordt alleen die tekst vervangen. Lukt het opzoeken niet, dan blijft
         * de link staan zoals je hem plakte.
         *
         * De controle vóór het vervangen kijkt of er op die plek nog steeds
         * precies dezelfde url staat: heb je in de tussentijd doorgetypt of
         * ergens anders geklikt, dan gebeurt er niets.
         */
        handlePaste: (_view, event) => {
          const geplakt = event.clipboardData?.getData("text/plain")?.trim() ?? "";
          if (!/^https?:\/\/\S+$/.test(geplakt)) return false;
          event.preventDefault();

          const editorNu = editorRef.current;
          if (!editorNu) return false;
          editorNu
            .chain()
            .focus()
            .insertContent({
              type: "text",
              text: geplakt,
              marks: [{ type: "link", attrs: { href: geplakt } }],
            })
            .run();

          meldLinkUitleg.current(null);
          void titelVanLinkAction(geplakt).then(({ titel, uitleg }) => {
            const e = editorRef.current;
            if (!e) return;
            if (!titel || titel === geplakt) {
              // Geen titel is geen stilte meer: er staat nu bij waaróm, en wat
              // eraan te doen is (11-09-2026, zie link-acties.ts).
              meldLinkUitleg.current(uitleg);
              return;
            }
            const plek = zoekKaleLink(e, geplakt);
            if (!plek) return;
            e.chain()
              .focus()
              .command(({ tr }) => {
                tr.insertText(titel, plek.van, plek.tot);
                tr.addMark(
                  plek.van,
                  plek.van + titel.length,
                  e.schema.marks.link.create({ href: geplakt }),
                );
                return true;
              })
              .run();
          });
          return true;
        },
      },
      onCreate: ({ editor: e }) => {
        editorRef.current = e as Editor;
      },
      onUpdate: ({ editor: e }) => setMarkdown(htmlNaarMarkdown(e.getHTML())),
    },
    [waarde, controle.gelijk],
  );

  /**
   * Wisselen tussen opgemaakt en broncode. Van broncode terug naar opgemaakt
   * mag alleen als de ingetypte markdown het vangnet doorstaat; anders zou je
   * je eigen tekst kwijtraken op het moment dat je terugschakelt.
   */
  function wisselModus() {
    if (modus === "opgemaakt") {
      setModus("bron");
      return;
    }
    const huidig = bronVeld.current?.value ?? markdown;
    const check = rondlopen(huidig);
    if (!check.gelijk) {
      setMarkdown(huidig);
      return;
    }
    setMarkdown(huidig);
    editor?.commands.setContent(markdownNaarHtml(huidig));
    setModus("opgemaakt");
  }

  const bronKanTerug = useMemo(() => {
    if (modus !== "bron") return true;
    return rondlopen(markdown).gelijk;
  }, [modus, markdown]);

  const zetLink = useCallback(() => {
    if (!editor) return;
    const bestaand = editor.getAttributes("link").href as string | undefined;
    setLinkAdres(bestaand ?? "https://");
    setLinkVenster(true);
  }, [editor]);

  useEffect(() => {
    opentLink.current = zetLink;
  }, [zetLink]);

  function bevestigLink() {
    if (!editor) return;
    const adres = linkAdres.trim();
    if (!adres || adres === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: adres }).run();
    }
    setLinkVenster(false);
  }

  return (
    <div className="opmaakveld">
      {label && <label className="opmaakveld-label">{label}</label>}

      <div className="opmaakstrip" role="toolbar" aria-label="Opmaak">
        <div className="opmaakknoppen" id={`opmaakknoppen-${naam}`}>
          {modus === "opgemaakt" && editor ? (
            <Knoppen editor={editor} opLink={zetLink} />
          ) : (
            <span className="opmaakstrip-melding">
              {controle.gelijk
                ? "Broncode, je typt de markdown zelf."
                : "Broncode: dit dossier bevat opmaak die we niet ongewijzigd kunnen terugschrijven."}
            </span>
          )}

        </div>

        <span className="opmaakstrip-vuller" />
        <button
          type="button"
          className="opmaakknop opmaakstrip-modus"
          onClick={wisselModus}
          disabled={modus === "bron" && !bronKanTerug}
          title={
            modus === "opgemaakt"
              ? "Toon de markdown zelf"
              : bronKanTerug
                ? "Terug naar opgemaakte tekst"
                : "Deze markdown kan niet opgemaakt getoond worden zonder hem te veranderen"
          }
        >
          {modus === "opgemaakt" ? "</>" : "Aa"}
        </button>
      </div>

      {linkVenster && (
        <div className="opmaaklink">
          <input
            type="url"
            value={linkAdres}
            onChange={(e) => setLinkAdres(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                bevestigLink();
              }
              if (e.key === "Escape") setLinkVenster(false);
            }}
            placeholder="https://"
            autoFocus
          />
          <button type="button" className="pillbtn sterk" onClick={bevestigLink}>
            Link zetten
          </button>
          <button type="button" className="pillbtn licht" onClick={() => setLinkVenster(false)}>
            Annuleren
          </button>
        </div>
      )}

      {modus === "opgemaakt" ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          ref={bronVeld}
          className="opmaakbron"
          defaultValue={markdown}
          placeholder={plaatshouder}
          style={{ minHeight: minHoogte }}
          onChange={(e) => setMarkdown(e.target.value)}
        />
      )}

      {linkUitleg && (
        <p className="opmaakveld-uitleg" role="status">
          {linkUitleg}{" "}
          <button type="button" className="opmaakveld-uitleg-weg" onClick={() => setLinkUitleg(null)}>
            Sluiten
          </button>
        </p>
      )}

      {/* Wat er daadwerkelijk naar de server gaat. */}
      <input type="hidden" name={naam} value={markdown} />
    </div>
  );
}

/** De knoppen zelf. Apart, zodat ze bij elke selectiewijziging opnieuw tekenen. */
function Knoppen({ editor, opLink }: { editor: Editor; opLink: () => void }) {
  const knop = (
    aan: boolean,
    titel: string,
    inhoud: React.ReactNode,
    doen: () => void,
    extraKlasse = "",
  ) => (
    <button
      type="button"
      className={`opmaakknop${aan ? " aan" : ""}${extraKlasse ? " " + extraKlasse : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={doen}
      aria-pressed={aan}
      title={titel}
    >
      {inhoud}
    </button>
  );

  return (
    <>
      {knop(
        editor.isActive("heading", { level: 2 }),
        "Kop (Cmd+Alt+2)",
        "H",
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      )}
      {knop(editor.isActive("paragraph"), "Gewone tekst", "¶", () =>
        editor.chain().focus().setParagraph().run(),
      )}
      <span className="opmaakstrip-scheiding" />
      {knop(editor.isActive("bulletList"), "Opsomming", "•", () =>
        editor.chain().focus().toggleBulletList().run(),
      )}
      {knop(editor.isActive("orderedList"), "Genummerde lijst", "1.", () =>
        editor.chain().focus().toggleOrderedList().run(),
      )}
      {knop(editor.isActive("taskList"), "Vinklijst", "☑", () =>
        editor.chain().focus().toggleTaskList().run(),
      )}
      <span className="opmaakstrip-scheiding" />
      {knop(editor.isActive("bold"), "Vet (Cmd+B)", <b>B</b>, () =>
        editor.chain().focus().toggleBold().run(),
      )}
      {knop(editor.isActive("italic"), "Cursief (Cmd+I)", <i>I</i>, () =>
        editor.chain().focus().toggleItalic().run(),
      )}
      {knop(editor.isActive("underline"), "Onderstrepen (Cmd+U)", <u>U</u>, () =>
        editor.chain().focus().toggleUnderline().run(),
      )}
      {knop(editor.isActive("strike"), "Doorhalen", <s>S</s>, () =>
        editor.chain().focus().toggleStrike().run(),
      )}
      <span className="opmaakstrip-scheiding" />
      {knop(editor.isActive("link"), "Link (Cmd+K)", "🔗", opLink)}
      {knop(
        editor.isActive("table"),
        "Tabel invoegen",
        "▦",
        () =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      )}
      {knop(editor.isActive("blockquote"), "Citaat", "❝", () =>
        editor.chain().focus().toggleBlockquote().run(),
      )}
    </>
  );
}
