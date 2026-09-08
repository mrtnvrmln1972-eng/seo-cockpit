"use client";

import { useRef, useState, useTransition } from "react";
import { maakTaakAction } from "./actions";

/**
 * app/klant/[klantslug]/werkbord/NieuweTaakForm.tsx — het "Nieuwe taak"-
 * formulier op de Takenlijst-tab.
 *
 * GEWIJZIGD 08-09-2026: dit was een kale server-action <form>, zonder enige
 * feedback tijdens/na het opslaan. Dat leidde in productie (GardenSwimm)
 * tot 14 dubbele "Test."-taken: de knop "Toevoegen" gaf geen bezig-status en
 * geen bevestiging, dus leek een gelukte opslag alsof er niets gebeurde —
 * Maarten bleef daardoor op "Toevoegen" klikken. Zelfde patroon als
 * KlaarMeldenForm.tsx op het Developerbord: client component met
 * useTransition, de knop toont "Bezig…" en is dan uitgeschakeld (voorkomt
 * dubbel indienen), en na een gelukte opslag komt er twee seconden een
 * duidelijke "Toegevoegd"-melding in beeld.
 */
export default function NieuweTaakForm({ klantSlug }: { klantSlug: string }) {
  const [pending, startTransition] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData: FormData) => {
        setFout(null);
        setGelukt(false);
        startTransition(async () => {
          try {
            await maakTaakAction(klantSlug, formData);
            formRef.current?.reset();
            setGelukt(true);
            setTimeout(() => setGelukt(false), 2500);
          } catch (err) {
            setFout(err instanceof Error ? err.message : "Kon de taak niet toevoegen.");
          }
        });
      }}
    >
      <div className="metaveld">
        <label>Titel</label>
        <input
          type="text"
          name="titel"
          required
          placeholder="Wat moet er gebeuren?"
          disabled={pending}
        />
      </div>
      <div className="metaveld">
        <label>Notities (optioneel)</label>
        <textarea name="notities" placeholder="Korte context, mag leeg blijven" disabled={pending} />
      </div>

      {fout && <p className="foutregel">{fout}</p>}

      <div className="acties">
        <button className="pillbtn sterk" type="submit" disabled={pending}>
          {pending ? "Bezig…" : "Toevoegen"}
        </button>
        {gelukt && <span className="pill p-klaar">Toegevoegd</span>}
      </div>
    </form>
  );
}
