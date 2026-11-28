/* RunHistory — the PR timeline: every agent run interleaved with the PR's
   commits, newest-first and DB-backed so it survives reload. Showing commits
   between runs makes it clear which commit each review ran against. Failed runs
   show their error inline; the logs icon of a run opens its trace. */
import type { FindingRecord, PrCommit, RunSummary } from "@devdigest/shared";
import { CommitRow } from "./_components/CommitRow";
import { RunRow } from "./_components/RunRow";
import { buildTimeline } from "./helpers";
import { s } from "./styles";

interface RunHistoryProps {
  runs: RunSummary[];
  commits?: PrCommit[];
  /** Findings by run id, for the runs whose review is loaded. A run that is
      absent here (or has none) shows its plain finding count instead. */
  findingsByRun?: Record<string, FindingRecord[]>;
  /** owner/repo + head sha — used to link a finding's file:line to GitHub. */
  repoFullName?: string | null;
  headSha?: string | null;
  /** Open the trace + log drawer for a run (the logs icon). */
  onOpenTrace: (runId: string) => void;
  /** Jump to this run's inline review accordion below (clicking the agent name). */
  onGoToReview?: (runId: string) => void;
  onDelete?: (runId: string) => void;
}

const NO_COMMITS: PrCommit[] = [];
const NO_FINDINGS: FindingRecord[] = [];

export function RunHistory({
  runs,
  commits = NO_COMMITS,
  findingsByRun,
  repoFullName,
  headSha,
  onOpenTrace,
  onGoToReview,
  onDelete,
}: RunHistoryProps) {
  if (runs.length === 0 && commits.length === 0) return null;

  return (
    <div style={s.list}>
      {buildTimeline(runs, commits).map((item) =>
        item.kind === "commit" ? (
          <CommitRow key={`commit:${item.commit.sha}`} commit={item.commit} />
        ) : (
          <RunRow
            key={`run:${item.run.run_id}`}
            run={item.run}
            findings={findingsByRun?.[item.run.run_id] ?? NO_FINDINGS}
            repoFullName={repoFullName}
            headSha={headSha}
            onOpenTrace={onOpenTrace}
            onGoToReview={onGoToReview}
            onDelete={onDelete}
          />
        ),
      )}
    </div>
  );
}
