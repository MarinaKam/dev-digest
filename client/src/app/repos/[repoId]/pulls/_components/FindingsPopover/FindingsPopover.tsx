/* FindingsPopover — a severity tally that opens a list of findings. Hovering
   it previews the list; clicking it pins the list open so its links can be
   used. A pinned list closes on Escape, on a second click, on a click outside
   and when the page is scrolled. Each finding shows severity, title, category,
   file:line, confidence and the start of the rationale. Presentational: the
   caller supplies the findings (already ordered) and what a title click does. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CategoryTag, Icon, MonoLink, SEV } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { SeverityTally } from "../SeverityTally";
import { githubBlobUrl } from "@/lib/github-urls";
import { s } from "./styles";

const PERCENT = 100;
/** Panel width, the gap kept to the viewport edge, and the least useful height. */
const PANEL_WIDTH = 400;
const VIEWPORT_MARGIN = 12;
const MIN_PANEL_HEIGHT = 160;
const MAX_PANEL_HEIGHT = 420;
/** Gap between the trigger and the panel; it is padding of the hover area. */
const TRIGGER_GAP = 6;

/** Where to put the list for a trigger at `rect`: under it when there is room
    for a useful height, otherwise above it when that side has more room. It is
    kept inside the viewport horizontally and never taller than the room on the
    chosen side. */
function placeAround(rect: DOMRect): { wrapper: React.CSSProperties; maxHeight: number } {
  const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));
  const roomBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN - TRIGGER_GAP;
  const roomAbove = rect.top - VIEWPORT_MARGIN - TRIGGER_GAP;
  if (roomBelow >= MIN_PANEL_HEIGHT || roomBelow >= roomAbove) {
    return {
      wrapper: { top: rect.bottom, left, paddingTop: TRIGGER_GAP },
      maxHeight: Math.max(0, Math.min(MAX_PANEL_HEIGHT, roomBelow)),
    };
  }
  return {
    wrapper: { bottom: window.innerHeight - rect.top, left, paddingBottom: TRIGGER_GAP },
    maxHeight: Math.max(0, Math.min(MAX_PANEL_HEIGHT, roomAbove)),
  };
}

function location(f: FindingRecord): string {
  return f.start_line === f.end_line
    ? `${f.file}:${f.start_line}`
    : `${f.file}:${f.start_line}-${f.end_line}`;
}

export interface FindingsPopoverProps {
  /** Findings per severity — drawn as the tally. All zeros renders nothing. */
  counts: Record<Severity, number>;
  /** The findings to list, in display order. `undefined` = still loading. */
  findings: FindingRecord[] | undefined;
  /** Heading of the list, e.g. "5 findings in this run". */
  heading: string;
  /** owner/repo + head sha — when both are known, file:line links to GitHub. */
  repoFullName?: string | null;
  headSha?: string | null;
  /** What a click on a finding's title does (e.g. jump to the run's findings). */
  onSelect?: () => void;
  /** Called when the list opens or closes — lets the caller load on demand. */
  onOpenChange?: (open: boolean) => void;
}

export function FindingsPopover({
  counts,
  findings,
  heading,
  repoFullName,
  headSha,
  onSelect,
  onOpenChange,
}: FindingsPopoverProps) {
  const t = useTranslations("prReview");
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const open = hovered || pinned;

  const notifyRef = React.useRef(onOpenChange);
  notifyRef.current = onOpenChange;
  React.useEffect(() => {
    notifyRef.current?.(open);
  }, [open]);

  // The list is placed in viewport coordinates (position: fixed) so that a
  // clipping ancestor — the PR table card — cannot cut it off.
  const [place, setPlace] = React.useState<ReturnType<typeof placeAround> | null>(null);
  React.useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    setPlace(placeAround(rootRef.current.getBoundingClientRect()));
  }, [open]);

  // An open list closes when anything but the list itself is scrolled: it is
  // fixed to the viewport and would drift away from its trigger. A pinned list
  // also closes on Escape and on a click outside it.
  React.useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) =>
      !(target instanceof Node) || !rootRef.current?.contains(target);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (outside(e.target)) setPinned(false);
    };
    const onScroll = (e: Event) => {
      if (outside(e.target)) {
        setPinned(false);
        setHovered(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  if (counts.CRITICAL + counts.WARNING + counts.SUGGESTION === 0) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only widens the hover area (trigger + list); keyboard and screen-reader users operate the button inside it, which pins the list
    <span
      ref={rootRef}
      style={s.anchor}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // The tally can sit inside a clickable row. A row must not treat clicks
      // in here (the trigger, a link, a finding's title) as clicks on itself.
      data-row-action
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        style={s.trigger}
      >
        <SeverityTally counts={counts} />
      </button>
      {open && (
        <div style={{ ...s.bridge, ...place?.wrapper }}>
          <div role="dialog" aria-label={heading} style={{ ...s.panel, maxHeight: place?.maxHeight }}>
            <div style={s.heading}>
              <Icon.FileText size={12} aria-hidden />
              {heading}
            </div>
            {findings === undefined ? (
              <div style={s.loading}>{t("popover.loading")}</div>
            ) : findings.length === 0 ? (
              // The counts and the findings come from different requests; if
              // they disagree, say so instead of showing a bare heading.
              <div style={s.loading}>{t("popover.empty")}</div>
            ) : (
              <ul style={s.list}>
                {findings.map((f) => {
                  const sev = SEV[f.severity];
                  const LevelIcon = Icon[sev.icon];
                  const href =
                    repoFullName && headSha
                      ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)
                      : undefined;
                  return (
                    <li key={f.id} style={s.item}>
                      <div style={s.titleRow}>
                        <LevelIcon
                          size={13}
                          style={{ color: sev.c, flexShrink: 0 }}
                          aria-label={sev.label}
                        />
                        <button
                          type="button"
                          title={f.title}
                          style={s.title}
                          onClick={() => {
                            setPinned(false);
                            setHovered(false);
                            onSelect?.();
                          }}
                        >
                          {f.title}
                        </button>
                        <CategoryTag category={f.category} />
                      </div>
                      <div className="mono" style={s.meta}>
                        <span style={s.file}>
                          {href ? <MonoLink href={href}>{location(f)}</MonoLink> : location(f)}
                        </span>
                        <span className="tnum" style={s.conf}>
                          {Math.round(f.confidence * PERCENT)}% conf
                        </span>
                      </div>
                      <div style={s.rationale}>{f.rationale}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
