import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MarkdownBody } from "./MarkdownBody";

afterEach(cleanup);

describe("MarkdownBody", () => {
  it("renders headings, lists and emphasis as their elements", () => {
    render(<MarkdownBody>{"# Rule\n\n## Scope\n\n- one\n- two\n\n1. first\n\nSome **bold** text."}</MarkdownBody>);
    expect(screen.getByRole("heading", { level: 1, name: "Rule" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Scope" })).toBeInTheDocument();
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("styles inline code as a chip and fenced code as a block", () => {
    render(<MarkdownBody>{"Use `x` here.\n\n```\nconst y = 1;\n```"}</MarkdownBody>);
    expect(screen.getByText("x")).toHaveStyle({ background: "var(--bg-hover)" });
    const block = screen.getByText("const y = 1;");
    expect(block.closest("pre")).not.toBeNull();
    expect(block).not.toHaveStyle({ background: "var(--bg-hover)" });
  });

  it("does not load images from the body", () => {
    const { container } = render(<MarkdownBody>{"![tracker](https://evil.example/pixel.png)"}</MarkdownBody>);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/tracker/)).toBeInTheDocument();
  });

  it("opens links in a new tab without the opener, and drops javascript: links", () => {
    render(<MarkdownBody>{"[docs](https://example.com) and [bad](javascript:alert(1))"}</MarkdownBody>);
    const docs = screen.getByRole("link", { name: "docs" });
    expect(docs).toHaveAttribute("target", "_blank");
    expect(docs.getAttribute("rel")).toContain("noopener");
    const bad = screen.getByText("bad").closest("a");
    expect(bad?.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
  });

  it("does not render raw HTML from the body", () => {
    const { container } = render(<MarkdownBody>{'<img src="x" onerror="alert(1)">\n\n<b>raw</b> text'}</MarkdownBody>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });
});
