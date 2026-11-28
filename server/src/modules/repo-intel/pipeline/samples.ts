/**
 * repo-intel — picking sample files for the conventions extractor.
 *
 * Pure: takes paths, returns paths. The facade (`service.ts`) decides where the
 * paths come from (the rank table, or a walk of the clone when there is no rank).
 */

/** The folder a file sits in; `''` for a file at the repo root. */
function folderOf(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
}

/**
 * Up to `n` paths spread across folders: one file from each folder in turn,
 * folders taken in the order their first file appears, files in input order.
 * With ranked input the best file of every folder comes before the second-best
 * of any folder, so a rule is seen in several parts of the repo, not in one.
 */
export function spreadAcrossFolders(paths: readonly string[], n: number): string[] {
  if (n <= 0) return [];
  const queues = new Map<string, string[]>();
  for (const path of paths) {
    const folder = folderOf(path);
    const queue = queues.get(folder);
    if (queue) queue.push(path);
    else queues.set(folder, [path]);
  }
  const picked: string[] = [];
  const lists = [...queues.values()];
  for (let round = 0; picked.length < n; round += 1) {
    let tookAny = false;
    for (const list of lists) {
      const path = list[round];
      if (path === undefined) continue;
      picked.push(path);
      tookAny = true;
      if (picked.length >= n) break;
    }
    if (!tookAny) break;
  }
  return picked;
}
