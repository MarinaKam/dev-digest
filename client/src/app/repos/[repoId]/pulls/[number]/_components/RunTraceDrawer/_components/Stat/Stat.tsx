import type React from "react";
import { s } from "../../styles";

interface StatProps {
  label: string;
  val: React.ReactNode;
}

/** One labelled figure of the trace's stats grid. */
export function Stat({ label, val }: StatProps) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div className="tnum" style={s.statVal}>
        {val}
      </div>
    </div>
  );
}
