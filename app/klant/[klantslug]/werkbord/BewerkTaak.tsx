"use client";

import { useEffect, useRef, useState } from "react";
import { taakBewerkenAction } from "./actions";
import Opmaakveld from "@/app/_components/Opmaakveld";

/**
 * app/klant/[klantslug]/werkbord/BewerkTaak.tsx — de titel en de toelichting
 * van één taak, direct bewerkbaar zodra je de taak openklapt.
 *
 * HERZIEN 09-09-2026, op Maartens verzoek. Het was: bovenin de opgemaakte
 * tekst, daaronder een knop "Tekst aanpassen", en daar weer onder een apart
 * formulier met diezelfde tekst er nog een keer in en een knop "Opslaan". Zijn
 * woorden: "Als ik iets wil aanpassen, wil ik gewoon in het veld klikken dat
 * ik wil aanpassen. En niet ergens moeilijk over doen, maar gewoon dat het
 * autosaved."
 *
 * Nu: je klapt de taak open, de opmaakstrip staat bovenin, en je typt gewoon
 * in de tekst. Een seconde nadat je stopt met typen wordt het opgeslagen, met
 * een klein regeltje ernaast dat zegt wat er gebeurt. Geen knop, geen tweede
 * kopie van dezelfde tekst.
 *
 * Waarom het opslaan hier GEEN paginaverversing doet (revalidatePath): dat zou
 * midden in het typen verse tekst van de server terugsturen, en dan bouwt de
 * editor zichzelf opnieuw op en springt je cursor weg. De lijst eromheen krijgt
 * de nieuwe titel daarom rechtstreeks van hier door (onOpgeslagen).
 *
 * TWEE DINGEN RECHTGEZET OP 12-09-2026, na "hij is een beetje buggy":
 *
 *   1. Er kon meer dan één opslag tegelijk lopen. Het opslaan doet eerst een
 *      ronde langs Drive om de titel van geplakte links op te halen, en dat
 *      duurt tot een paar seconden. Typte je in de tussentijd door, dan ging
 *      er een tweede opslag langs met dezelfde "zo zag het bestand eruit"-
 *      stempel, en die kwam terug met "dit bestand is intussen elders
 *      gewijzigd, laad de pagina opnieuw" terwijl er niemand anders aan het
 *      werk was. Nu wacht een tweede opslag netjes op de eerste.
 *   2. Wat de server WEGSCHRIJFT gaat terug naar het scherm. Een kale link
 *      wordt bij het opslaan `[Titel](url)`; dat stond dus wél in Drive maar
 *      niet in beeld, tot je de pagina herlaadde.
 */

/** Zoveel wachten na de laatste toetsaanslag voordat we opslaan. */
const WACHT_MS = 900;

type Stand = "rust" | "bezig" | "klaar" | "fout";

export default function BewerkTaak({
  klantSlug,
  n,
  titel,
  toelichting,
  onOpgeslagen,
}: {
  klantSlug: string;
  n: number;
  titel: string;
  toelichting: string;
  onOpgeslagen?: (titel: string, toelichting: string) => void;
}) {
  const [stand, setStand] = useState<Stand>("rust");
  const [fout, setFout] = useState<string | null>(null);

  const laatstOpgeslagen = useRef({ titel, toelichting });
  const huidig = useRef({ titel, toelichting });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Loopt er nu een opslag? Zo ja, dan wacht de volgende daarop. */
  const bezig = useRef<Promise<void> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function planOpslaan() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void slaOp(), WACHT_MS);
  }

  /**
   * Eén opslag tegelijk. Loopt er al een, dan gaat deze er achteraan in plaats
   * van ernaast: twee gelijktijdige schrijfacties op hetzelfde dossierbestand
   * botsen op de versiecontrole in lib/drive.ts en leveren dan een melding op
   * die nergens op slaat.
   */
  function slaOp(): Promise<void> {
    const volgende = (bezig.current ?? Promise.resolve()).then(() => slaNuOp());
    bezig.current = volgende.finally(() => {
      if (bezig.current === volgende) bezig.current = null;
    });
    return volgende;
  }

  async function slaNuOp() {
    const { titel: t, toelichting: tl } = huidig.current;
    if (t.trim() === "") return; // een taak zonder titel slaan we niet op
    if (t === laatstOpgeslagen.current.titel && tl === laatstOpgeslagen.current.toelichting) return;
    setStand("bezig");
    setFout(null);
    try {
      const bewaard = await taakBewerkenAction(klantSlug, n, t, tl);
      // Wat wij verstuurden blijft de maatstaf voor "is er sindsdien iets
      // veranderd"; wat de server ervan maakte gaat terug naar het scherm.
      laatstOpgeslagen.current = { titel: t, toelichting: tl };
      onOpgeslagen?.(bewaard.titel, bewaard.toelichting);
      setStand("klaar");
      setTimeout(() => setStand((s) => (s === "klaar" ? "rust" : s)), 1800);
    } catch {
      // Bewust een vaste, gewone zin: wat een server action bij een fout
      // teruggeeft is in productie een dichtgetimmerde technische melding
      // ("Minified React error ..."), en daar heb je hier niets aan.
      setStand("fout");
      setFout("Opslaan lukte niet. Je tekst staat er nog; probeer het zo nog eens.");
    }
  }

  return (
    <div className="taakbewerken">
      <div className="metaveld">
        <label htmlFor={`titel-${n}`}>Titel</label>
        <input
          id={`titel-${n}`}
          type="text"
          defaultValue={titel}
          onChange={(e) => {
            huidig.current = { ...huidig.current, titel: e.target.value };
            planOpslaan();
          }}
          onBlur={() => void slaOp()}
        />
      </div>

      <Opmaakveld
        naam={`toelichting-${n}`}
        waarde={toelichting}
        label="Toelichting"
        minHoogte={200}
        onChange={(markdown) => {
          huidig.current = { ...huidig.current, toelichting: markdown };
          planOpslaan();
        }}
      />

      <p className={`opslagstand${stand === "fout" ? " fout" : ""}`}>
        {stand === "bezig" && "Opslaan…"}
        {stand === "klaar" && "Opgeslagen"}
        {stand === "fout" && (fout ?? "Kon deze taak niet opslaan.")}
        {stand === "rust" && "Wijzigingen worden vanzelf opgeslagen."}
      </p>
    </div>
  );
}
