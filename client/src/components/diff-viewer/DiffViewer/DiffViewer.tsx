/* DiffViewer — basic GitHub-style unified diff viewer. Renders real PrFile.patch
   (unified-diff text from the F1 API) as a list of collapsible FileCards.
   Optional inline comments (Files changed tab): hover a line → "+" → comment,
   posted live to GitHub; existing GitHub review comments render inline. */
"use client";

import { useTranslations } from "next-intl";
import type { PrFile } from "@devdigest/shared";
import { type DiffCommentApi } from "../comments";
import { s } from "../styles";
import { FileCard } from "../FileCard";

interface DiffViewerProps {
  files: PrFile[];
  commenting?: DiffCommentApi;
}

export function DiffViewer({ files, commenting }: DiffViewerProps) {
  const t = useTranslations("shell");
  if (!files || files.length === 0) {
    return <div style={s.empty}>{t("diffViewer.noChangedFiles")}</div>;
  }
  return (
    <div style={s.list}>
      {files.map((file) => (
        <FileCard key={file.path} file={file} commenting={commenting} />
      ))}
    </div>
  );
}
