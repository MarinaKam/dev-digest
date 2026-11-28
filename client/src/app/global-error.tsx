/* Last-resort boundary: catches an exception thrown by the root layout itself,
   so it replaces that layout and must render <html> and <body>. The providers
   (theme, messages, query client) are gone at this point, which is why the text
   is written here in English and the styles do not use design tokens. */
"use client";

import type { CSSProperties } from "react";

const TITLE = "DevDigest could not start";
const BODY = "The app shell failed to render. Try again; if it keeps failing, reload the page.";
const RETRY = "Try again";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  display: "grid",
  placeItems: "center",
  fontFamily: "system-ui, sans-serif",
  background: "#0b0d10",
  color: "#e6e8eb",
};
const boxStyle: CSSProperties = { maxWidth: 420, padding: 24, textAlign: "center" };
const bodyStyle: CSSProperties = { color: "#9aa3ad", lineHeight: 1.5 };
const buttonStyle: CSSProperties = {
  marginTop: 16,
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #3a4048",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body style={pageStyle}>
        <main style={boxStyle}>
          <h1>{TITLE}</h1>
          <p style={bodyStyle}>{BODY}</p>
          <button type="button" onClick={reset} style={buttonStyle}>
            {RETRY}
          </button>
        </main>
      </body>
    </html>
  );
}
