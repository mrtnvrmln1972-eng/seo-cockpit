"use client";

import { useState, useTransition } from "react";
import { klaarMeldenAction } from "./actions";

/**
 * Het "Klaar melden"-formulier voor een OPEN taak op het Developerbord
 * (08-09-2026, op Maartens verzoek: de developer moet verplicht aangeven
 * hoe lang hij ermee bezig is geweest, en kan optioneel terugkoppelen).
 *
 * Client component (niet gewoon een <form action={...}> zoals de rest van
 * het bord) om twee redenen: (1) het formulier moet pas verschijnen NA een
 * klik op "Klaar melden" — dat is lokale, niet-persistente UI-state, geen
 * dossierdata; (2) een mislukte inzending (bijv. VersionConflictError) moet
 * hier, in het formulier zelf, een leesbare melding tonen zonder de rest
 * van de pagina te laten crashen — vandaar de eigen try/catch rond de
 * server action in plaats van een kale <form action={serverActie}>.
 */
export default function KlaarMeldenForm({
  klantSlug,
  klantFolderId,
  n,
}: {
  klantSlug: string;
  klantFolderId: string;
  n: number;
}) {
  const [open, setOpen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="pillbtn sterk" onClick={() => setOpen(true)}>
        Klaar melden
      </button>
    );
  }

  return (
    <form
      className="klaarmeldform"
      action={(formData: FormData) => {
        setFout(null);
        startTransition(async () => {
          try {
            await klaarMeldenAction(klantSlug, formData);
            setOpen(false);
          } catch (err) {
            setFout(err instanceof Error ? err.message : "Kon de taak niet klaar melden.");
          }
        });
      }}
    >
      <input type="hidden" name="klantFolderId" value={klantFolderId} />
      <input type="hidden" name="n" value={n} />

      <div className="metaveld">
        <label>Tijd besteed</label>
        <input
          type="text"
          name="tijdsduur"
          required
          placeholder="bijv. 45 min"
          disabled={pending}
        />
      </div>
      <div className="metaveld">
        <label>Opmerkingen (optioneel)</label>
        <textarea
          name="terugkoppeling"
          placeholder="Terugkoppeling voor Maarten"
          disabled={pending}
        />
      </div>

      {fout && <p className="foutregel">{fout}</p>}

      <div className="acties">
        <button className="pillbtn sterk" type="submit" disabled={pending}>
          {pending ? "Bezig…" : "Melden"}
        </button>
        <button
          className="pillbtn licht"
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
