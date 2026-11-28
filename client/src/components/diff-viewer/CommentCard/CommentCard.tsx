/* CommentCard — one review comment rendered as a Card with avatar + markdown
   body. Used by CommentThreadView and OutdatedComments. */
"use client";

import { useTranslations } from "next-intl";
import { Icon, Card, Avatar, Markdown } from "@devdigest/ui";
import type { PrReviewComment } from "@devdigest/shared";
import { formatDateTime } from "@/lib/format-date";
import { cs, s } from "../styles";

interface CommentCardProps {
  c: PrReviewComment;
}

export function CommentCard({ c }: CommentCardProps) {
  const t = useTranslations("shell");
  return (
    <Card>
      <div style={cs.headRow}>
        <Avatar name={c.user} size={20} />
        <span style={cs.user}>{c.user}</span>
        <span style={cs.time}>{formatDateTime(c.created_at)}</span>
        <span style={s.spacer} />
        <a href={c.html_url} target="_blank" rel="noopener noreferrer" style={cs.ghLink}>
          <Icon.ExternalLink size={12} />
          {t("diffViewer.viewOnGitHub")}
        </a>
      </div>
      <div style={cs.mdBody}>
        <Markdown>{c.body}</Markdown>
      </div>
    </Card>
  );
}
