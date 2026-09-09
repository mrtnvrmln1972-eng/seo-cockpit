/**
 * Het deelregeltje bovenaan het Servicepunten-tabblad: alleen het label en de
 * link zelf, klikbaar en te selecteren.
 *
 * VERKLEIND 09-09-2026, op verzoek: hier stond een blok met een uitleggende
 * zin, een breed kader om de link heen en twee knoppen (kopiëren, mailtje
 * openen). Maarten kopieert de link zelf; wat er stond kostte alleen ruimte
 * boven het overzicht waar het op de pagina om gaat. Wat de link doet
 * (alleen lezen, alleen deze pagina) staat op de gedeelde pagina zelf.
 */
export default function DeelLink({ url }: { url: string }) {
  return (
    <p className="deelregel">
      <span className="deelregel-lbl">Deelbare link</span>
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    </p>
  );
}
