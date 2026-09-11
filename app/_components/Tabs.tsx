"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NOC_SLUG } from "@/lib/servicepunten-model";

/**
 * De vaste tabbalk per klant: Roadmap, Signalen, Meta-tool. Elke tab is een
 * eigen route onder /klant/[klantslug]/... — zie CLAUDE.md/README.md voor
 * waar de volgende agents hun tabblad bouwen.
 *
 * Vormgeving 1:1 naar de artifact's .tabs/.tab (sticky kaart boven de
 * inhoud, aria-selected in plaats van een losse "actief"-klasse).
 *
 * Oorspronkelijk vier tabs (Roadmap, Issues, Kansen, Meta-tool), zoals de
 * artifact-specificatie beschrijft. Issues en Kansen zijn samengevoegd tot
 * één "Signalen"-tab omdat de echte, actuele signalen.md-bestanden van live
 * klanten geen "## Issues"/"## Kansen"-secties meer hebben — zie de
 * doc-comment in app/klant/[klantslug]/signalen/page.tsx en CLAUDE.md.
 *
 * Takenlijst (werkbord) is, net als in de artifact (vKlant()'s taboptreden
 * begint met "werkbord|Takenlijst"), de EERSTE tab — een klant opent op de
 * Takenlijst, niet op de Roadmap (08-09-2026, op Maartens uitdrukkelijke
 * verzoek zo gecorrigeerd).
 *
 * Notities toegevoegd op 08-09-2026, op dezelfde plek als in de artifact se
 * eigen tabrij (['werkbord','onboarding','roadmap','issues','kansen',
 * 'notities','dev','meta',...]): na de signalen-achtige tabs (hier
 * samengevoegd tot "Signalen"), voor Meta-tool. Zie lib/notities.ts voor
 * hoe die inhoud gelezen wordt.
 *
 * Onboarding toegevoegd op 09-09-2026, op dezelfde plek als in de artifact
 * se eigen tabrij hierboven: direct na Takenlijst, voor Roadmap. Zie
 * lib/onboarding.ts voor hoe die inhoud gelezen/geschreven wordt.
 *
 * Servicepunten toegevoegd op 09-09-2026: dit tabblad bestaat NIET voor elke
 * klant, alleen voor Nationaal Oogcentrum (op Maartens uitdrukkelijke
 * verzoek, zie lib/servicepunten.ts). Vandaar de conditionele toevoeging
 * hieronder in plaats van een vaste plek in TABS: elke andere klant houdt
 * exact dezelfde zes tabs als voorheen.
 *
 * Resultaten toegevoegd op 11-09-2026, rechts van Meta-tool op Maartens
 * verzoek: de cijfers uit Search Console (later Analytics, Ads en Ahrefs),
 * zoals ze in het oude SEO-dashboard op de tab "resultaten" stonden. Zie
 * lib/google-data.ts voor waar die cijfers vandaan komen en lib/kpi-dossier.ts
 * voor wat je er zelf in vastzet.
 */
const TABS = [
  { segment: "werkbord", label: "Takenlijst" },
  { segment: "onboarding", label: "Onboarding" },
  { segment: "roadmap", label: "Roadmap" },
  { segment: "signalen", label: "Signalen" },
  { segment: "notities", label: "Notities" },
  { segment: "meta", label: "Meta-tool" },
  { segment: "resultaten", label: "Resultaten" },
] as const;

export default function Tabs({ klantSlug }: { klantSlug: string }) {
  const pathname = usePathname();
  // Zelfde voorlaad-bij-aanwijzen als in de klantenlijst (zie NavLink.tsx):
  // één tabblad tegelijk, alleen degene die je aanwijst.
  const router = useRouter();
  const voorgeladen = useRef(new Set<string>());
  const tabs: readonly { segment: string; label: string }[] =
    klantSlug === NOC_SLUG ? [...TABS, { segment: "servicepunten", label: "Servicepunten" }] : TABS;

  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => {
        const href = `/klant/${klantSlug}/${tab.segment}`;
        const actief = pathname === href;
        const laadVoor = () => {
          if (actief || voorgeladen.current.has(href)) return;
          voorgeladen.current.add(href);
          router.prefetch(href);
        };
        return (
          <Link
            key={tab.segment}
            href={href}
            prefetch={false}
            onMouseEnter={laadVoor}
            onFocus={laadVoor}
            onTouchStart={laadVoor}
            role="tab"
            aria-selected={actief}
            className="tab"
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
