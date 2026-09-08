"use client";

import { useState, useTransition } from "react";
import { zetNaarDeveloperbordAction } from "./actions";

/**
 * app/klant/[klantslug]/werkbord/DoorzettenKnop.tsx — 08-09-2026 toegevoegd
 * als bugfix: "Naar developerbord" was een kale server-form-knop
 * (<form action={...}><button type="submit">) zonder enige pending-guard.
 * Zo'n knop geeft tijdens het schrijven naar Drive geen enkele visuele
 * terugkoppeling, dus leek het voor Maarten alsof er "niks gebeurde" — met
 * als gevolg dat hij (of gewoon een dubbelklik) nog een keer drukte, en de
 * taak zo 2x/3x werd doorgezet naar developer.md (zichtbaar als letterlijke
 * duplicaten in de "nog niet ingepland"-pool van het Developerbord).
 *
 * Fix: een client component met useTransition die de knop meteen disabled
 * zet en "Bezig…" toont zodra hij is ingedrukt, zodat een tweede klik simpel
 * niets meer doet zolang de eerste nog loopt. Zelfde patroon als
 * KlaarMeldenForm.tsx/BewerkTaakForm.tsx elders in de app.
 */
export default function DoorzettenKnop({ klantSlug, n }: { klantSlug: string; n: number }) {
  const [pending, startTransition] = useTransition();
  const [fout, setFout] = useState<string | null>(null);

  return (
    <div className="doorzetknopwrap">
      <button
        type="button"
        className="pillbtn sterk"
        disabled={pending}
        onClick={() => {
          if (pending) return;
          setFout(null);
          startTransition(async () => {
            try {
              await zetNaarDeveloperbordAction(klantSlug, n);
            } catch (err) {
              setFout(err instanceof Error ? err.message : "Kon de taak niet doorzetten.");
            }
          });
        }}
      >
        {pending ? "Bezig…" : "Naar developerbord"}
      </button>
      {fout && <p className="foutregel">{fout}</p>}
    </div>
  );
}
