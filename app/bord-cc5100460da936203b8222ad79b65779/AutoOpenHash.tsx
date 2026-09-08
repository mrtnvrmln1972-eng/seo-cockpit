"use client";

import { useEffect } from "react";

/**
 * Als het "Mailen naar developer"-linkje op een taak binnenkomt (URL met
 * #taak-<klantslug>-<n>), staat die taakrij standaard dichtgeklapt als hij
 * al klaar/afgerond is (zie page.tsx: alleen open-status-taken staan
 * standaard open). Een <details> die dicht staat, klapt bij het volgen van
 * een #-link zelf niet open — dus zet 'm hier één keer bij het laden expliciet
 * open en scroll ernaartoe, zodat de developer direct de volledige context
 * ziet in plaats van alleen de titelregel.
 */
export default function AutoOpenHash() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView({ block: "start" });
  }, []);

  return null;
}
