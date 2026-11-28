/* format-date.ts — locale-aware date and time text for timestamps from the API. */

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date and time in the user's locale; an unparseable value is returned as is. */
export function formatDateTime(iso: string): string {
  return parse(iso)?.toLocaleString() ?? iso;
}

/** Time of day in the user's locale; an unparseable or missing value gives "". */
export function formatTime(iso: string | null | undefined): string {
  return parse(iso)?.toLocaleTimeString() ?? "";
}
