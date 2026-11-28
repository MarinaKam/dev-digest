/* RunStatus — live SSE status for in-flight review runs. Subscribes to the
   run event streams and renders the shared LiveLogStream. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { LiveLogStream, type LogLine } from "@devdigest/ui";
import { useRunEvents } from "@/lib/hooks/reviews";
import { LOG_HEIGHT } from "./constants";
import { s } from "./styles";

interface RunStatusProps {
  runIds: string[];
  /** Called once each time the event streams go from running to closed. */
  onDone?: () => void;
}

export function RunStatus({ runIds, onDone }: RunStatusProps) {
  const t = useTranslations("prReview");
  const { events, running } = useRunEvents(runIds);
  const wasRunning = React.useRef(false);

  React.useEffect(() => {
    if (running) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    // Reset first: `onDone` is often a new function on every parent render, and
    // each of those re-runs this effect — it must report a finished stream once.
    wasRunning.current = false;
    onDone?.();
  }, [running, onDone]);

  if (runIds.length === 0) return null;

  const log: LogLine[] = events.map((e) => ({
    t: e.t,
    k: e.kind as LogLine["k"],
    m: e.msg,
  }));

  return (
    <div style={s.wrap}>
      <LiveLogStream
        log={log}
        running={running}
        height={LOG_HEIGHT}
        elapsedLabel={running ? t("runStatus.elapsed", { count: runIds.length }) : undefined}
      />
    </div>
  );
}
