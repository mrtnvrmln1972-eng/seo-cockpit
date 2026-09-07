"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * De vaste tabbalk per klant: Roadmap, Signalen, Meta-tool. Elke tab is een
 * eigen route onder /klant/[klantslug]/... — zie CLAUDE.md/README.md voor
 * waar de volgende agents hun tabblad bouwen.
 *
 * Oorspronkelijk vier tabs (Roadmap, Issues, Kansen, Meta-tool), zoals de
 * artifact-specificatie beschrijft. Issues en Kansen zijn samengevoegd tot
 * één "Signalen"-tab omdat de echte, actuele signalen.md-bestanden van live
 * klanten geen "## Issues"/"## Kansen"-secties meer hebben — zie de
 * doc-comment in app/klant/[klantslug]/signalen/page.tsx en CLAUDE.md.
 */
const TABS = [
  { segment: "roadmap", label: "Roadmap" },
  { segment: "signalen", label: "Signalen" },
  { segment: "meta", label: "Meta-tool" },
] as const;

export default function Tabs({ klantSlug }: { klantSlug: string }) {
  const pathname = usePathname();

  return (
    <nav className="tabbalk">
      {TABS.map((tab) => {
        const href = `/klant/${klantSlug}/${tab.segment}`;
        const actief = pathname === href;
        return (
          <Link key={tab.segment} href={href} className={`tab${actief ? " actief" : ""}`}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
