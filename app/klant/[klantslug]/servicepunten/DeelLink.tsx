"use client";

import { useState } from "react";

/**
 * De deelbare link bovenaan het Servicepunten-tabblad: één knop die hem naar
 * het klembord kopieert.
 *
 * VERKLEIND 10-09-2026, op verzoek: eerst stond de volledige link uitgeschreven
 * in beeld ("ik hoef niet de hele link te zien"). Nu alleen de knop; het adres
 * zit erin. Lukt kopiëren niet (een browser die het klembord blokkeert), dan
 * komt de link alsnog in beeld zodat je hem met de hand kunt pakken.
 */
export default function DeelLink({ url }: { url: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const [toon, setToon] = useState(false);

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(url);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
    } catch {
      setToon(true);
    }
  }

  return (
    <span className="deelknopvak">
      <button type="button" className="pillbtn licht klein" onClick={kopieer} title={url}>
        {gekopieerd ? "Link gekopieerd" : "Deelbare link kopiëren"}
      </button>
      {toon && (
        <a className="deelregel-terugval" href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      )}
    </span>
  );
}
