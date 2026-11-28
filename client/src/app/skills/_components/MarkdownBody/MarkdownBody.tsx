"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { s } from "./styles";

interface MarkdownBodyProps {
  children: string;
}

/** True inside a fenced code block, so `code` renders as block text, not as an inline chip. */
const InBlock = React.createContext(false);

function Code({ children }: { children?: React.ReactNode }) {
  const block = React.useContext(InBlock);
  if (block) return <code className="mono">{children}</code>;
  return (
    <code className="mono" style={s.inlineCode}>
      {children}
    </code>
  );
}

const COMPONENTS: Components = {
  h1: ({ children }) => <h1 style={s.h1}>{children}</h1>,
  h2: ({ children }) => <h2 style={s.h2}>{children}</h2>,
  h3: ({ children }) => <h3 style={s.h3}>{children}</h3>,
  ul: ({ children }) => <ul style={s.ul}>{children}</ul>,
  ol: ({ children }) => <ol style={s.ol}>{children}</ol>,
  li: ({ children }) => <li style={s.li}>{children}</li>,
  p: ({ children }) => <p style={s.p}>{children}</p>,
  strong: ({ children }) => <strong style={s.strong}>{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} style={s.link}>
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <InBlock.Provider value={true}>
      <pre className="mono" style={s.pre}>
        {children}
      </pre>
    </InBlock.Provider>
  ),
  code: ({ children }) => <Code>{children}</Code>,
};

/**
 * A skill body rendered as Markdown with headings, lists and code blocks
 * styled for reading. Raw HTML in the body is not rendered (no `rehype-raw`).
 */
export function MarkdownBody({ children }: MarkdownBodyProps) {
  return (
    <div style={s.root}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
