"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Chip, FormField, Modal, TextInput } from "@devdigest/ui";
import { useImportPreview, useImportUrlPreview } from "@/lib/hooks/skills";
import { ImportReview } from "./_components/ImportReview";
import { s } from "./styles";

interface ImportSkillModalProps {
  onClose: () => void;
  /** Called with the id of the saved skill. */
  onCreated: (id: string) => void;
}

type Source = "file" | "url";

/**
 * "Import": pick a .md or .zip, or give a public https URL; review the draft
 * and the report, then save. A URL import is the same untrusted text as a file.
 */
export function ImportSkillModal({ onClose, onCreated }: ImportSkillModalProps) {
  const t = useTranslations("skills");
  const filePreview = useImportPreview();
  const urlPreview = useImportUrlPreview();
  const [source, setSource] = React.useState<Source>("file");
  const [url, setUrl] = React.useState("");
  // A new file or URL remounts the review, so its form starts from the new draft.
  const [seq, setSeq] = React.useState(0);
  const preview = source === "file" ? filePreview : urlPreview;

  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so choosing the same file again (after fixing it) fires again.
    e.target.value = "";
    if (!file) return;
    setSeq((n) => n + 1);
    filePreview.mutate(file);
  };

  const fetchUrl = () => {
    if (!url.trim()) return;
    setSeq((n) => n + 1);
    urlPreview.mutate(url.trim());
  };

  return (
    <Modal width={760} title={t("import.title")} subtitle={t("import.subtitle")} onClose={onClose}>
      <div style={s.body}>
        <div style={s.tabs}>
          <Chip active={source === "file"} onClick={() => setSource("file")}>
            {t("import.fromFile")}
          </Chip>
          <Chip active={source === "url"} onClick={() => setSource("url")}>
            {t("import.fromUrl")}
          </Chip>
        </div>
        {source === "file" ? (
          <input
            type="file"
            accept=".md,.zip"
            aria-label={t("import.fileLabel")}
            onChange={choose}
            style={s.fileInput}
          />
        ) : (
          <FormField label={t("import.urlLabel")} hint={t("import.urlHint")}>
            <div style={s.urlRow}>
              <TextInput
                mono
                type="url"
                aria-label={t("import.urlLabel")}
                value={url}
                onChange={setUrl}
                placeholder={t("import.urlPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchUrl();
                }}
              />
              <Button kind="primary" onClick={fetchUrl} disabled={!url.trim() || urlPreview.isPending}>
                {urlPreview.isPending ? t("import.fetching") : t("import.fetchUrl")}
              </Button>
            </div>
          </FormField>
        )}
        {filePreview.isPending && source === "file" && <div style={s.muted}>{t("import.reading")}</div>}
        {/* The toast also reports it, but the reason (413 too large, 422 not public)
            is about the chosen file or URL, so it stays next to the input. */}
        {preview.error && (
          <div role="alert" style={s.error}>
            {source === "file"
              ? t("import.previewFailed", { message: preview.error.message })
              : t("import.urlFailed", { message: preview.error.message })}
          </div>
        )}
        {preview.data && !preview.isPending && (
          <ImportReview
            key={`${source}-${seq}`}
            preview={preview.data}
            // The URL that was downloaded, not the field: it may have been edited since.
            origin={source === "url" ? urlPreview.variables : undefined}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
      </div>
    </Modal>
  );
}
