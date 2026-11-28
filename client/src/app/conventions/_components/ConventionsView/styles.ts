import type { CSSProperties } from "react";
import { PAGE_MAX_WIDTH } from "../../constants";

/* Design: `ScreenConventions` in screen_conv_conf.jsx. */
export const s = {
  page: { padding: "20px 28px 40px", maxWidth: PAGE_MAX_WIDTH, margin: "0 auto" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 } satisfies CSSProperties,
  headerText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  title: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  repo: { color: "var(--accent-text)" } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", marginTop: 3 } satisfies CSSProperties,
  headerActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } satisfies CSSProperties,
  count: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  toolbarEnd: { marginLeft: "auto" } satisfies CSSProperties,
  notice: (tone: "error" | "ok" | "info"): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 13px",
    borderRadius: 8,
    marginBottom: 14,
    fontSize: 12.5,
    border: `1px solid ${tone === "error" ? "var(--crit)" : tone === "ok" ? "var(--ok)" : "var(--border)"}`,
    background: tone === "error" ? "var(--crit-bg)" : tone === "ok" ? "var(--ok-bg)" : "var(--bg-elevated)",
    color: "var(--text-primary)",
  }),
  /* `ddspin` is defined in src/vendor/ui/styles.css. */
  spin: { animation: "ddspin 1s linear infinite", flexShrink: 0 } satisfies CSSProperties,
  noticeLink: { marginLeft: "auto", color: "var(--accent-text)", fontSize: 12.5 } satisfies CSSProperties,
  loading: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
