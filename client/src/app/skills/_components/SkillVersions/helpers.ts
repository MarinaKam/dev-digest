export type DiffKind = "same" | "removed" | "added";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/**
 * Line diff of two texts by longest common subsequence. A line only in `oldText`
 * is `removed`, a line only in `newText` is `added`, the rest is `same`.
 */
export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const width = b.length + 1;

  // table[i * width + j] = length of the common subsequence of a[i..] and b[j..]
  const table = new Uint32Array((a.length + 1) * width);
  const at = (i: number, j: number): number => table[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] ?? "" });
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      out.push({ kind: "removed", text: a[i] ?? "" });
      i++;
    } else {
      out.push({ kind: "added", text: b[j] ?? "" });
      j++;
    }
  }
  for (; i < a.length; i++) out.push({ kind: "removed", text: a[i] ?? "" });
  for (; j < b.length; j++) out.push({ kind: "added", text: b[j] ?? "" });
  return out;
}

/** The marker printed before a diff line. */
export function diffPrefix(kind: DiffKind): string {
  if (kind === "removed") return "-";
  if (kind === "added") return "+";
  return " ";
}

/**
 * The viewer's time zone. The app configures no global `timeZone` for
 * next-intl, and its formatter reports an error for every date formatted
 * without one; the versions load in the browser, so the browser's zone is the
 * right one.
 */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** True when the two texts differ in at least one line. */
export function hasChanges(diff: DiffLine[]): boolean {
  return diff.some((line) => line.kind !== "same");
}
