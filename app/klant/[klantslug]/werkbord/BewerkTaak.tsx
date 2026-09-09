"use client";

import { useRef, useState, useTransition } from "react";
import { taakBewerkenAction } from "./actions";

/**
 * app/klant/[klantslug]/werkbord/BewerkTaak.tsx — de titel en de toelichting
 * van één taak aanpassen, vanuit de taak zelf (09-09-2026, op verzoek).
 *
 * Het veld toont de RUWE tekst uit toelichting.md, niet de gerenderde versie
 * die eromheen staat. Dat is bewust: dat bestand wordt ook buiten deze app
 * gelezen en geschreven (zie CLAUDE.md), dus wat je hier typt is precies wat
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
      <div className="metaveld">
        <label htmlFor={`toelichting-${n}`}>Toelichting</label>
        <textarea
          id={`toelichting-${n}`}
          name="toelichting"
          rows={12}
          defaultValue={toelichting}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
      </div>
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
