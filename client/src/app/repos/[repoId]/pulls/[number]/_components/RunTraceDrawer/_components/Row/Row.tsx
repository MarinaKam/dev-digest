import type React from "react";
import { s } from "../../styles";

interface RowProps {
  label: string;
  children: React.ReactNode;
}

/** One labelled line of the trace's configuration list. */
export function Row({ label, children }: RowProps) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      {children}
    </div>
  );
}
