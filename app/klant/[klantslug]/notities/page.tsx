import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesNotities } from "@/lib/notities";

import NotitiesKaart from "./NotitiesKaart";
import { renderTekst } from "@/lib/scanbaar";

export const dynamic = "force-dynamic";

/**
 * Notities-tab. Toont notities.md, precies zoals het bestand er staat.
 *
 * Sinds 09-09-2026 is dit één kaart: je leest de nette weergave en je klikt
 * "Bewerken" om op diezelfde plek in de tekst te schrijven, met de opmaakstrip
 * erboven. Daarvoor stond de bewerkkant in een tweede kaart eronder, en dan
 * moest je voor één zinnetje eerst naar beneden en een kopie van dezelfde
 * tekst openklappen. Zie NotitiesKaart.tsx.
 *
 * Wat er wordt opgeslagen blijft exact de markdown uit notities.md: het
 * bestand wordt ook buiten deze app gelezen en geschreven (Cowork, de skills),
 * dus er verandert niets aan de opmaak wat jij niet zelf hebt getypt.
 */
export default async function NotitiesPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  if (!klant.mapId) {
    return (
      <div className="paneel">
        <p className="placeholder">Deze klant heeft nog geen dossier in Drive.</p>
      </div>
    );
  }

  let notities: Awaited<ReturnType<typeof leesNotities>> | null = null;
  let foutmelding: string | null = null;
  try {
    notities = await leesNotities(klant.mapId);
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van notities.md.";
  }

  if (foutmelding) {
    return (
      <div className="foutbanner">
        Kan notities.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  const md = notities?.md ?? "";

  return <NotitiesKaart klantSlug={klant.slug} md={md} html={renderTekst(md)} />;
}
