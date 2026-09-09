"use client";

import { useRef, useState, useTransition } from "react";
import { taakBewerkenAction } from "./actions";
import Opmaakveld from "@/app/_components/Opmaakveld";

/**
 * app/klant/[klantslug]/werkbord/BewerkTaak.tsx — de titel en de toelichting
 * van één taak aanpassen, vanuit de taak zelf (09-09-2026, op verzoek).
 *
 * Sinds 09-09-2026 is dit een Opmaakveld: je ziet vet als vet in plaats van
 * sterretjes, met een opmaakstrip en de gewone sneltoetsen. Wat er wordt
 * opgeslagen blijft exact dezelfde markdown, en bevat het bestand iets wat
 * niet ongewijzigd terug te schrijven is, dan valt het veld zichtbaar terug op
 * broncode-modus. Zie app/_components/Opmaakveld.tsx en lib/opmaak.ts.
 *
 * De oude uitleg hieronder blijft gelden voor WAT er opgeslagen wordt: dat
 * bestand wordt ook buiten deze app gelezen en geschreven (zie CLAUDE.md),
 * dus wat je hier typt is precies wat
 * er in het dossier komt te staan. Een tekstvak dat de opmaak zelf
 * "verbetert" zou dat stilletjes uit elkaar laten lopen.
 *
 * Dichtgeklapt tenzij je hem opent, zodat de taak zelf leesbaar blijft en het
 * lezen niet steeds langs een formulier moet.
 */
export default function BewerkTaak({
  klantSlug,
  n,
  titel,
  toelichting,
}: {
  klantSlug: string;
  n: number;
  titel: string;
  toelichting: string;
}) {
  const [open, setOpen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState(false);
  const [bezig, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button type="button" className="pillbtn licht" onClick={() => setOpen(true)}>
        Tekst aanpassen
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="taakbewerken"
      action={(formData: FormData) => {
        setFout(null);
        setGelukt(false);
        startTransition(async () => {
          try {
            await taakBewerkenAction(klantSlug, n, formData);
            setGelukt(true);
            setTimeout(() => setGelukt(false), 2500);
          } catch (err) {
            setFout(err instanceof Error ? err.message : "Kon deze taak niet opslaan.");
          }
        });
      }}
    >
      <div className="metaveld">
        <label htmlFor={`titel-${n}`}>Titel</label>
        <input id={`titel-${n}`} name="titel" type="text" defaultValue={titel} required />
      </div>
      <Opmaakveld naam="toelichting" waarde={toelichting} label="Toelichting" minHoogte={220} />
      {fout && <p className="foutregel">{fout}</p>}
      <div className="acties">
        <button className="pillbtn sterk" type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan"}
        </button>
        <button type="button" className="pillbtn licht" onClick={() => setOpen(false)}>
          Sluiten
        </button>
        {gelukt && <span className="pill p-klaar">Opgeslagen</span>}
      </div>
    </form>
  );
}
