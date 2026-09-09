/**
 * turndown-plugin-gfm levert geen eigen typen mee. We gebruiken alleen gfm(),
 * de bundel met tabellen, doorhalen en vinklijsten; de losse onderdelen laten
 * we bewust weg zodat hier niet meer staat dan we echt aanroepen.
 */
declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";
  export function gfm(service: TurndownService): void;
}
