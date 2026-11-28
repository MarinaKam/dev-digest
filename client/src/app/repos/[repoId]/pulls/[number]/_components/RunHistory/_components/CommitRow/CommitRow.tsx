import { Icon } from "@devdigest/ui";
import type { PrCommit } from "@devdigest/shared";
import { formatTime } from "@/lib/format-date";
import { s } from "../../styles";

const SHORT_SHA_LENGTH = 7;

interface CommitRowProps {
  commit: PrCommit;
}

/** One commit of the PR, shown between the runs it sits chronologically between. */
export function CommitRow({ commit }: CommitRowProps) {
  return (
    <div style={s.commitRow}>
      <Icon.GitCommit size={15} style={s.commitIcon} />
      <span className="mono" style={s.commitSha}>
        {commit.sha.slice(0, SHORT_SHA_LENGTH)}
      </span>
      <span style={s.commitMessage} title={commit.message}>
        {commit.message.split("\n")[0]}
      </span>
      <span style={s.meta}>{commit.author}</span>
      {commit.committed_at && <span style={s.meta}>{formatTime(commit.committed_at)}</span>}
    </div>
  );
}
