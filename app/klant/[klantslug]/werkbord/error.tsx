"use client";

/**
 * Minimale error-boundary voor de Takenlijst-tab. Vangt fouten uit
 * maakTaakAction/zetNaarDeveloperbordAction op (o.a. VersionConflictError,
 * omgezet naar een leesbare Nederlandse melding in actions.ts) en toont ze
 * in dezelfde stijl als de foutmelding die de andere tabs al gebruiken
 * (.foutbanner), met een knop om het opnieuw te proberen.
 */
export default function WerkbordError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="foutbanner">
      Er ging iets mis op de Takenlijst.
      <br />
      {error.message || "Onbekende fout."}
      <div className="acties" style={{ marginTop: 10 }}>
        <button className="pillbtn licht" type="button" onClick={() => reset()}>
          Opnieuw proberen
        </button>
      </div>
    </div>
  );
}
