/**
 * lib/link-cel.ts — één adres uit een dossiercel lezen, in de twee vormen
 * waarin het daar staat: een kale url, of `[Titel](url)`.
 *
 * Bewust een eigen, piepklein bestand en niet in lib/links.ts: dat bestand is
 * server-only (het praat met Drive), en de vestigingskaart is een client
 * component. Zonder deze scheiding zou de hele Drive-client in de browser
 * belanden, of zou de vestigingskaart het adres opnieuw moeten uitpluizen met
 * een tweede regex die na een maand van de eerste afwijkt.
 *
 * Aanleiding (11-09-2026): in het vestigingsoverzicht stond het geplakte
 * adres in een invoerveld, dus als tekst waar je alleen je cursor in zet. Er
 * zat een klein pijltje naast dat de pagina opende, maar Maartens verwachting
 * is de gewone: "als je hier een link plakt, dan moet ie ook gewoon klikbaar
 * zijn en dan ga je naar die pagina."
 */

export interface LinkCel {
  /** Het adres zelf, altijd zonder opmaak eromheen. Leeg als er niets staat. */
  url: string;
  /** Wat er op het scherm hoort te staan: de titel, anders een korte url. */
  label: string;
}

/**
 * Een url korter maken zonder hem onherkenbaar te maken: het protocol en een
 * www eraf, en een lang pad in het midden inkorten. Dit is geen titel en doet
 * ook niet alsof: het is het adres zelf, alleen leesbaar.
 */
export function korteUrl(url: string, maxLengte = 60): string {
  let kaal = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  kaal = kaal.replace(/\/$/, "");
  if (kaal.length <= maxLengte) return kaal;
  const houd = Math.floor((maxLengte - 1) / 2);
  return `${kaal.slice(0, houd)}…${kaal.slice(-houd)}`;
}

/** Leest een cel die een kale url of een `[Titel](url)` bevat. */
export function leesLinkCel(cel: string): LinkCel {
  const tekst = (cel || "").trim();
  if (!tekst) return { url: "", label: "" };

  const md = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(tekst);
  if (md) return { url: md[2], label: md[1].trim() || korteUrl(md[2]) };

  if (/^https?:\/\/\S+$/i.test(tekst)) return { url: tekst, label: korteUrl(tekst) };

  // Iets anders (een notitie, een half adres): laten staan zoals het staat,
  // en niet doen alsof het een link is.
  return { url: "", label: tekst };
}
