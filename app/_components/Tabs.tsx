"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * De vaste tabbalk per klant: Roadmap, Issues, Kansen, Meta-tool. Elke tab
 * is een eigen route onder /klant/[klantslug]/... — zie CLAUDE.md/README.md
 * voor waar de volgende agents hun tabblad bouwen.
 */
const TABS = [
  { segment: "roadmap", label: "Roadmap" },
  { segment: "issues", label: "Issues" },
  { segment: "kansen", label: "Kansen" },
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
