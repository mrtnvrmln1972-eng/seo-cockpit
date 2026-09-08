"use client";

/**
 * Error-boundary voor het Developerbord. Zonder deze boundary toont Next.js
 * in productie een lege/onveranderde pagina plus een onleesbare, geminifieerde
 * React-foutmelding in de console (React error #441, geen details) zodra
 * zetStatusAction faalt — precies het "hopelijk goed werkend" risico dat
 * Maarten benoemde. Zelfde patroon als app/klant/[klantslug]/werkbord/error.tsx.
 */
export default function DeveloperbordError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="foutbanner">
      Er ging iets mis op het Developerbord.
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
