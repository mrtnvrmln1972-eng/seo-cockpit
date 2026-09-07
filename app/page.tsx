import { getKlantGroepen } from "@/lib/klanten";

/**
 * Startpagina ("Overzicht"), naar het voorbeeld van vHome() in de
 * bestaande artifact: een korte stand van zaken in tellers (.sum) en een
 * uitlegkader (.kader). De tellers zijn pure optellingen van wat al in
 * KLANTEN.md staat — geen eigen weging (CLAUDE.md: "een dashboard mag
 * tonen, nooit oordelen").
 */
export default async function Home() {
  let groepen: Awaited<ReturnType<typeof getKlantGroepen>> = [];
  let foutmelding: string | null = null;

  try {
    groepen = await getKlantGroepen();
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van klanten.";
  }

  if (foutmelding) {
    return (
      <div className="foutbanner">
        Kan de klantenlijst niet laden vanuit Google Drive.
        <br />
        {foutmelding}
      </div>
    );
  }

  const eigen = groepen.find((g) => g.id === "eigen")?.klanten ?? [];
  const mc = groepen.find((g) => g.id === "mc")?.klanten ?? [];
  const lead = groepen.find((g) => g.id === "lead")?.klanten ?? [];
  const stil = eigen.filter((k) => k.fase.trim().toLowerCase() === "stil").length;
  const eigenActief = eigen.length - stil;
  const metDossier = [...eigen, ...mc, ...lead].filter((k) => k.mapId !== null).length;

  return (
    <div>
      <div className="kop">
        <h2>Overzicht</h2>
      </div>
      <p className="subkop">Alle klanten uit KLANTEN.md, in één blik.</p>

      <div className="sum">
        <div>
          <b>{eigenActief}</b>
          <span>Eigen klanten actief</span>
        </div>
        <div>
          <b>{stil}</b>
          <span>Stil</span>
        </div>
        <div>
          <b>{mc.length}</b>
          <span>Multimedia Concepts</span>
        </div>
        <div>
          <b>{lead.length}</b>
          <span>Leads</span>
        </div>
        <div className="acc">
          <b>{metDossier}</b>
          <span>Met dossier in Drive</span>
        </div>
      </div>

      <div className="kader">
        <h3>Hoe je hiermee werkt</h3>
        <p>
          Kies links een klant. Elk klantdossier heeft drie tabbladen: <strong>Roadmap</strong>{" "}
          (de paginaprestaties uit roadmap.md), <strong>Signalen</strong> (wat er is
          opgevallen, uit signalen.md) en <strong>Meta-tool</strong> (titel- en
          omschrijvingsvoorstellen tegen de META-controles, uit meta.md).
        </p>
        <p>
          Dit dashboard toont precies wat er in de dossierbestanden staat — het rekent geen
          eigen prioriteit of urgentie uit. Wil je overleggen wat te doen? Dat gebeurt in een
          apart gesprek, niet in dit scherm.
        </p>
      </div>
    </div>
  );
}
