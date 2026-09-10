"use client";

import { useState } from "react";

/**
 * De deelbare link bovenaan het Servicepunten-tabblad: één knop die hem naar
 * het klembord kopieert.
 *
 * Vorm van 10-09-2026, naar Maartens eigen voorbeeld: het label, de link zelf
 * op één regel, en een klein kopieerknopje ernaast. Lukt kopiëren niet (een
 * browser die het klembord blokkeert), dan staat de link er nog gewoon om met
 * de hand te pakken.
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
    <div className="deelbalk">
      <span className="deelbalk-lbl">Deelbare link</span>
      <a className="deelbalk-url" href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
      <button
        type="button"
        className="deelbalk-kopie"
        onClick={kopieer}
        title="Link kopiëren"
        aria-label="Link kopiëren"
      >
        {gekopieerd ? "✓" : "⧉"}
      </button>
      {toon && <span className="deelbalk-hulp">Kopiëren lukte niet, selecteer de link hierboven.</span>}
    </div>
  );
}
