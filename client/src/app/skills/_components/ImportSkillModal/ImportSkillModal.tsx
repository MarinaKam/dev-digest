"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@devdigest/ui";
import { useImportPreview } from "@/lib/hooks/skills";
import { ImportReview } from "./_components/ImportReview";
import { s } from "./styles";

interface ImportSkillModalProps {
  onClose: () => void;
  /** Called with the id of the saved skill. */
  onCreated: (id: string) => void;
}

/** "Import from file": pick a .md or .zip, review the draft and the report, then save. */
export function ImportSkillModal({ onClose, onCreated }: ImportSkillModalProps) {
  const t = useTranslations("skills");
  const preview = useImportPreview();
  // A new file remounts the review, so its form starts from the new draft.
  const [fileSeq, setFileSeq] = React.useState(0);

  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileSeq((n) => n + 1);
    preview.mutate(file);
  };

  return (
    <Modal width={760} title={t("import.title")} subtitle={t("import.subtitle")} onClose={onClose}>
      <div style={s.body}>
        <input
          type="file"
          accept=".md,.zip"
          aria-label={t("import.fileLabel")}
          onChange={choose}
          style={s.fileInput}
        />
        {preview.isPending && <div style={s.muted}>{t("import.reading")}</div>}
        {/* The toast also reports it, but the reason (413 too large, 422 no SKILL.md)
            is about the chosen file, so it stays next to the file input. */}
        {preview.error && (
          <div role="alert" style={s.error}>
            {t("import.previewFailed", { message: preview.error.message })}
          </div>
        )}
        {preview.data && !preview.isPending && (
          <ImportReview key={fileSeq} preview={preview.data} onClose={onClose} onCreated={onCreated} />
        )}
      </div>
    </Modal>
  );
}
