"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import { countLines, estimateTokens } from "../helpers";
import { s } from "./styles";

interface BodyEditorProps {
  /** Skill name, shown as the file name in the header. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** The body differs from the saved one. */
  unsaved?: boolean;
  /** The body breaks a rule: the frame turns red. */
  invalid?: boolean;
}

/** Monospace Markdown editor with a line-number gutter and a token estimate. */
export function BodyEditor({ name, value, onChange, unsaved, invalid }: BodyEditorProps) {
  const t = useTranslations("skills");
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const lines = Array.from({ length: countLines(value) }, (_, i) => i + 1).join("\n");

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  return (
    <div style={s.frame(!!invalid)}>
      <div style={s.header}>
        <span className="mono" style={s.filename}>
          {name || "skill"}.md
        </span>
        {unsaved && <Badge color="var(--warn)">{t("fields.unsaved")}</Badge>}
        <span className="tnum" style={s.tokens}>
          {t("fields.tokens", { count: estimateTokens(value) })}
        </span>
      </div>
      <div style={s.area}>
        <div ref={gutterRef} className="mono tnum" aria-hidden="true" style={s.gutter}>
          {lines}
        </div>
        <textarea
          className="mono"
          aria-label={t("fields.bodyLabel")}
          value={value}
          placeholder={t("fields.bodyPlaceholder")}
          spellCheck={false}
          wrap="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          style={s.textarea}
        />
      </div>
    </div>
  );
}
