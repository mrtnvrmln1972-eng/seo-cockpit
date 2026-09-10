"use client";

import { useEffect, useRef, useState } from "react";
import Opmaakveld from "@/app/_components/Opmaakveld";

/**
 * Een blok vrije tekst met de opmaakstrip erboven, dat zichzelf opslaat.
 *
 * HERZIEN 10-09-2026, op Maartens verzoek: er zat een knop "Opslaan" onder,
 * en tekst die je typte zonder erop te drukken was weg. Zijn woorden: "ik
 * wil niet eerst op een opslaan-knop hoeven drukken om het te bewaren. Het
 * mag gewoon autosave en snel." Nu wordt er kort na de laatste toetsaanslag
 * vanzelf opgeslagen, met een regeltje eronder dat zegt wat er gebeurt.
 *
 * De tekst die de editor start met (`begin`) wordt bij het eerste renderen
 * vastgezet en daarna niet meer bijgewerkt. Dat is bewust: elke schrijfactie
 * doet een revalidatePath, waarna de server dezelfde tekst opnieuw
 * doorgeeft, en Opmaakveld bouwt de editor opnieuw op zodra die tekst
 * wijzigt. Midden in het typen zou je cursor dan wegspringen (zelfde reden
 * als in werkbord/BewerkTaak.tsx). Een wijziging van buitenaf zie je bij de
 * volgende paginalading.
 */

/** Zoveel wachten na de laatste toetsaanslag voordat we opslaan. */
const WACHT_MS = 800;

type Stand = "rust" | "bezig" | "klaar" | "fout";

export default function NotitieVeld({
  naam,
  waarde,
  plaatshouder,
  minHoogte = 110,
  opslaan,
}: {
  naam: string;
  waarde: string;
  plaatshouder?: string;
  minHoogte?: number;
  opslaan: (tekst: string) => Promise<void>;
}) {
  const [begin] = useState(waarde);
  const [stand, setStand] = useState<Stand>("rust");
  const [fout, setFout] = useState<string | null>(null);

  const laatstOpgeslagen = useRef(waarde);
  const huidig = useRef(waarde);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function slaOp() {
    const tekst = huidig.current;
    if (tekst === laatstOpgeslagen.current) return;
    setStand("bezig");
    setFout(null);
    try {
      await opslaan(tekst);
      laatstOpgeslagen.current = tekst;
      setStand("klaar");
      setTimeout(() => setStand((s) => (s === "klaar" ? "rust" : s)), 1800);
    } catch (err) {
      setStand("fout");
      setFout(err instanceof Error ? err.message : "Opslaan lukte niet. Je tekst staat er nog.");
    }
  }

  return (
    <div className="sp-notitieveld">
      <Opmaakveld
        naam={naam}
        waarde={begin}
        plaatshouder={plaatshouder}
        minHoogte={minHoogte}
        onChange={(tekst) => {
          huidig.current = tekst;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void slaOp(), WACHT_MS);
        }}
      />
      <p className={`opslagstand${stand === "fout" ? " fout" : ""}`}>
        {stand === "bezig" && "Opslaan…"}
        {stand === "klaar" && "Opgeslagen"}
        {stand === "fout" && (fout ?? "Kon dit niet opslaan.")}
        {stand === "rust" && "Wijzigingen worden vanzelf opgeslagen."}
      </p>
    </div>
  );
}
