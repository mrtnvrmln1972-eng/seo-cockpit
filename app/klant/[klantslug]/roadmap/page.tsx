import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesDossierBestand } from "@/lib/dossier";
import { renderCel } from "@/lib/markdown";
import {
  groepeerRoadmapPaginas,
  sorteerGroepenMetOverigAchteraan,
  koppelSignalenAanPagina,
  vindPaginaKolom,
  vindKolomVoor,
  veldWaarde,
} from "@/lib/roadmap";
import { leesLaatsteCrawl } from "@/lib/crawl";
import RoadmapBord, { type PaginaKaart, type RoadmapGroepUI, type SignaalKaart } from "./RoadmapBord";
import styles from "./roadmap.module.css";

export const dynamic = "force-dynamic";

/**
 * Roadmap-tab — 08-09-2026 herbouwd naar een kolommenbord (hoofdmenu-groep =
 * kolom, pagina = kaart) met een klik-detailvenster, op verzoek van Maarten:
 * de vorige, verticaal-uitklapbare lijstweergave (dezelfde dag eerder
 * gebouwd) vond hij "een stuk minder overzichtelijk" en "toont ook niet de
 * navigatiestructuur" vergeleken met de claude.ai-artifact die hij weken
 * gebruikte. Die artifact-vormgeving is nu de expliciete richtlijn: kolommen
 * per hoofdmenu-groep, een kaart per pagina met woordaantal/score/voortgang,
 * en een klik opent een venster met "Roadmap, paginaradar" +
 * "Screaming Frog, laatste crawl" + de gekoppelde signalen.md-rijen.
 *
 * De groepering zelf (lib/roadmap.ts, groepeerRoadmapPaginas) en de
 * signalen-koppeling (koppelSignalenAanPagina) zijn ONGEWIJZIGD hergebruikt
 * uit de vorige versie — gebouwd tegen de echte Kamsteeg-data, zie de
 * doc-comment daar. Nieuw is lib/crawl.ts: leest de nieuwste
 * crawls/crawl-JJJJ-MM-DD.md uit de klantmap (bevestigd tegen Kamsteegs
 * crawl-2026-09-03.md) voor het Screaming Frog-blok. Ontbreekt die crawl-map
 * bij een klant, dan blijft dat blok in het detailvenster gewoon leeg — geen
 * foutmelding, net als bij signalen.md.
 *
 * Score-kleur in de kaart (goed/kan beter/nog veel te doen) volgt de vaste
 * banden 80/50 die roadmap.md's eigen methodewoord zelf al noemt ("Vanaf 80
 * 'Goed ingericht', vanaf 50 'Kan beter', daaronder 'Nog veel te doen'") —
 * geen nieuwe drempel die dit dashboard zelf verzint, puur het al bestaande
 * scoreveld anders weergegeven (CLAUDE.md, "toont, oordeelt nooit").
 */
export default async function RoadmapPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  let bestand: Awaited<ReturnType<typeof leesDossierBestand>> = null;
  let foutmelding: string | null = null;
  try {
    bestand = await leesDossierBestand(klant, "roadmap.md");
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van roadmap.md.";
  }

  if (foutmelding) {
    return (
      <div className="foutbanner">
        Kan roadmap.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  if (!bestand) {
    return (
      <div className="paneel">
        <p className="placeholder">Nog geen roadmap.md gevonden in de dossiermap van {klant.naam}.</p>
      </div>
    );
  }

  const ruweGroepen = groepeerRoadmapPaginas(bestand.content);
  const groepen = sorteerGroepenMetOverigAchteraan(ruweGroepen);

  if (groepen.length === 0) {
    return (
      <div className="paneel">
        <p className="placeholder">roadmap.md staat er, maar er is geen paginatabel in gevonden.</p>
      </div>
    );
  }

  // signalen.md en de crawlsamenvatting zijn allebei aanvullende, best-effort
  // context — ontbreken ze of faalt het lezen, dan blijft de rest van de tab
  // gewoon werken (geen foutbanner, geen uitlegzin).
  let signalenContent = "";
  try {
    const signalenBestand = await leesDossierBestand(klant, "signalen.md");
    if (signalenBestand) signalenContent = signalenBestand.content;
  } catch {
    signalenContent = "";
  }

  let crawl: Awaited<ReturnType<typeof leesLaatsteCrawl>> = null;
  try {
    crawl = await leesLaatsteCrawl(klant);
  } catch {
    crawl = null;
  }

  const domein = (klant.domein || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const groepenUI: RoadmapGroepUI[] = groepen.map((groep) => ({
    naam: groep.naam,
    paginas: groep.paginas.map((rij, idx) => {
      const paginaKolom = vindPaginaKolom(rij) ?? "Pagina";
      const titelKolom = vindKolomVoor(rij, ["titel", "naam"]);
      const groepKolom = vindKolomVoor(rij, ["groep", "menugroep", "hoofdmenu", "hoofdpagina"]);
      const pad = (rij[paginaKolom] ?? "").trim();
      const titel = titelKolom ? rij[titelKolom].trim() : "";

      const scoreRaw = veldWaarde(rij, ["score"]).trim();
      const scoreNum = scoreRaw ? Number(scoreRaw.replace(",", ".")) : NaN;
      const scoreBand: PaginaKaart["scoreBand"] = Number.isNaN(scoreNum)
        ? ""
        : scoreNum >= 80
          ? "goed"
          : scoreNum >= 50
            ? "kan-beter"
            : "nog-veel";

      const voortgangRaw = veldWaarde(rij, ["voortgang"]).trim();

      const uitgesloten = new Set(
        [paginaKolom, titelKolom, groepKolom, "#"].filter((k): k is string => Boolean(k)).map((k) => k.trim().toLowerCase()),
      );
      const roadmapVelden = Object.entries(rij)
        .filter(([key, waarde]) => waarde.trim().length > 0 && !uitgesloten.has(key.trim().toLowerCase()))
        .map(([key, waarde]) => ({ label: key, html: renderCel(waarde) }));

      const crawlRegel = pad ? crawl?.paginas.get(pad) : undefined;
      const crawlVelden = crawlRegel
        ? Object.entries(crawlRegel.velden)
            .filter(([key, waarde]) => key.trim().toLowerCase() !== "url" && waarde.trim().length > 0)
            .map(([key, waarde]) => ({ label: key, html: renderCel(waarde) }))
        : [];

      const gekoppeldeSignalen = pad ? koppelSignalenAanPagina(signalenContent, pad) : [];
      const signalen: SignaalKaart[] = gekoppeldeSignalen.map(({ sectie, rij: signaalRij }) => {
        const titelKolomSignaal = vindKolomVoor(signaalRij, ["signaal", "type", "titel", "naam"]);
        const nummerKolom = vindKolomVoor(signaalRij, ["#", "nr"]);
        const signaalTitel = titelKolomSignaal ? signaalRij[titelKolomSignaal] : "";
        const metaVeldnamen = ["urgentie", "tier", "status"];
        const meta = metaVeldnamen
          .map((naam) => veldWaarde(signaalRij, [naam]))
          .filter((v) => v.trim().length > 0);

        const metaExclusie = new Set(
          [titelKolomSignaal, nummerKolom, "Urgentie", "Tier", "Status", "Datum gemeten"]
            .filter((k): k is string => Boolean(k))
            .map((k) => k.trim().toLowerCase()),
        );
        const velden = Object.entries(signaalRij)
          .filter(([key, waarde]) => waarde.trim().length > 0 && !metaExclusie.has(key.trim().toLowerCase()))
          .map(([key, waarde]) => ({ label: key, html: renderCel(waarde) }));

        return {
          sectie,
          titel: (nummerKolom ? `#${signaalRij[nummerKolom]} — ` : "") + (signaalTitel || "(zonder titel)"),
          meta,
          velden,
        };
      });

      const kaart: PaginaKaart = {
        key: `${groep.naam}-${pad || idx}`,
        pad,
        titel,
        woorden: veldWaarde(rij, ["woorden"]),
        score: scoreRaw,
        scoreBand,
        voortgang: voortgangRaw,
        voortgangKlaar: /^100\s*%$/.test(voortgangRaw),
        status: veldWaarde(rij, ["status"]),
        geblokkeerd: veldWaarde(rij, ["geblokkeerd"]),
        signalenCount: signalen.length,
        livePaginaUrl: domein && pad ? `https://${domein}${pad}` : null,
        roadmapVelden,
        crawlVelden,
        crawlDatum: crawlRegel?.crawlDatum ?? null,
        signalen,
      };
      return kaart;
    }),
  }));

  const alleRijen = groepen.flatMap((g) => g.paginas);
  const aantalGeblokkeerd = alleRijen.filter((rij) => veldWaarde(rij, ["geblokkeerd"]).trim().length > 0).length;
  const scores = alleRijen
    .map((rij) => Number(veldWaarde(rij, ["score"]).trim().replace(",", ".")))
    .filter((n) => !Number.isNaN(n));
  const gemiddeldeScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div>
      <div className={styles.sum}>
        <div className={styles.sumItem}>
          <span className={styles.sumNum}>{alleRijen.length}</span>
          <span className={styles.sumLabel}>Pagina&apos;s</span>
        </div>
        <div className={styles.sumItem}>
          <span className={styles.sumNum}>{groepen.length}</span>
          <span className={styles.sumLabel}>Onderdelen in het menu</span>
        </div>
        {gemiddeldeScore !== null && (
          <div className={styles.sumItem}>
            <span className={styles.sumNum}>{gemiddeldeScore}</span>
            <span className={styles.sumLabel}>Gemiddelde score</span>
          </div>
        )}
        <div className={styles.sumItem}>
          <span className={styles.sumNum}>{aantalGeblokkeerd}</span>
          <span className={styles.sumLabel}>Geblokkeerd</span>
        </div>
      </div>

      <RoadmapBord groepen={groepenUI} />
    </div>
  );
}
