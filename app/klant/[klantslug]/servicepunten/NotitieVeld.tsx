"use client";

import { useState } from "react";
import Opmaakveld from "@/app/_components/Opmaakveld";

/**
 * Een blok vrije tekst met de opmaakstrip erboven en een eigen opslaanknop.
 * Bewust met een knop en niet bij het verlaten van het veld: in een editor
 * klik je gemakkelijk even weg (een link plakken, een woord opzoeken) en dan
 * hoort er niet elke keer een schrijfactie op Drive te vertrekken.
 */
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
  const [tekst, setTekst] = useState(waarde);
  const [bezig, setBezig] = useState(false);
  const [gelukt, setGelukt] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  return (
    <div className="sp-notitieveld">
      <Opmaakveld
        naam={naam}
        waarde={waarde}
        plaatshouder={plaatshouder}
        minHoogte={minHoogte}
        onChange={setTekst}
      />
      {fout && <p className="foutregel">{fout}</p>}
      <div className="acties">
        <button
          type="button"
          className="pillbtn sterk klein"
          disabled={bezig || tekst === waarde}
          onClick={async () => {
            setBezig(true);
            setFout(null);
            try {
              await opslaan(tekst);
              setGelukt(true);
              setTimeout(() => setGelukt(false), 2000);
            } catch (err) {
              setFout(err instanceof Error ? err.message : "Kon dit niet opslaan.");
            } finally {
              setBezig(false);
            }
          }}
        >
          {bezig ? "Bezig…" : "Opslaan"}
        </button>
        {gelukt && <span className="pill p-klaar">Opgeslagen</span>}
      </div>
    </div>
  );
}

