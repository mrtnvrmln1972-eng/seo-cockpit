"use client";

/**
 * Live zoekveld boven de klantenlijst (artifact: #zoek). Puur een
 * client-side filter over de al server-gerenderde `.navlink`-elementen —
 * geen eigen route, geen herlaad van de klantenlijst. Elke `.navlink`
 * draagt `data-naam` (zie NavLink.tsx); regels die niet matchen krijgen
 * `hidden`.
 */
export default function NavZoek() {
  function filter(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.trim().toLowerCase();
    const nav = e.target.closest(".nav");
    if (!nav) return;
    nav.querySelectorAll<HTMLElement>(".navlink[data-naam]").forEach((el) => {
      const naam = el.dataset.naam ?? "";
      el.hidden = q.length > 0 && !naam.includes(q);
    });
  }

  return (
    <input
      type="search"
      className="zoek"
      placeholder="Zoek een klant…"
      aria-label="Zoek een klant"
      onChange={filter}
    />
  );
}
