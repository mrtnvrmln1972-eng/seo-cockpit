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

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function planOpslaan() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void slaOp(), WACHT_MS);
  }

  async function slaOp() {
    const { titel: t, toelichting: tl } = huidig.current;
    if (t.trim() === "") return; // een taak zonder titel slaan we niet op
    if (t === laatstOpgeslagen.current.titel && tl === laatstOpgeslagen.current.toelichting) return;
    setStand("bezig");
    setFout(null);
    try {
      await taakBewerkenAction(klantSlug, n, t, tl);
      laatstOpgeslagen.current = { titel: t, toelichting: tl };
      onOpgeslagen?.(t, tl);
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
