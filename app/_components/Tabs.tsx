"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
 */
const TABS = [
  { segment: "werkbord", label: "Takenlijst" },
  { segment: "onboarding", label: "Onboarding" },
  { segment: "roadmap", label: "Roadmap" },
  { segment: "signalen", label: "Signalen" },
  { segment: "notities", label: "Notities" },
  { segment: "meta", label: "Meta-tool" },
] as const;

export default function Tabs({ klantSlug }: { klantSlug: string }) {
  const pathname = usePathname();

  return (
    <div className="tabs" role="tablist">
      {TABS.map((tab) => {
        const href = `/klant/${klantSlug}/${tab.segment}`;
        const actief = pathname === href;
        return (
          <Link
            key={tab.segment}
            href={href}
            prefetch={false}
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
