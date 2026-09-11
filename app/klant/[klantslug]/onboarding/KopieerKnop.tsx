"use client";

import { useState } from "react";

/**
 * Eén knop die een tekst op het klembord zet. Zelfde rol als in de Claude
 * Artifact: de aanvraag of de opdracht staat kant en klaar, jij hoeft hem
 * alleen te plakken in een mail of in een Cowork-gesprek.
 *
 * Lukt kopiëren niet (een browser die het niet toestaat, of een pagina zonder
 * https), dan komt de tekst in beeld in plaats van dat er niets gebeurt.
 */
export default function KopieerKnop({
  tekst,
  label,
  sterk,
}: {
  tekst: string;
  label: string;
  sterk?: boolean;
}) {
  const [stand, setStand] = useState<"rust" | "gelukt" | "mislukt">("rust");

  return (
    <>
      <button
        type="button"
        className={sterk ? "pillbtn sterk" : "pillbtn"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(tekst);
            setStand("gelukt");
            setTimeout(() => setStand("rust"), 2200);
          } catch {
            setStand("mislukt");
          }
        }}
      >
        {stand === "gelukt" ? "Gekopieerd" : label}
      </button>
      {stand === "mislukt" && (
        <p className="ob-kopieerfout">
          Kopiëren lukt hier niet, dus hier staat de tekst om zelf te nemen:
          <textarea readOnly value={tekst} rows={5} />
        </p>
      )}
    </>
  );
}
