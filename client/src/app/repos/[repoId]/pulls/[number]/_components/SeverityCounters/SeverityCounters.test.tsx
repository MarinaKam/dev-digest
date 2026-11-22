import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { SeverityCounters, type SeverityCountersProps } from "./SeverityCounters";

afterEach(cleanup);

function renderCounters(props: Partial<SeverityCountersProps> = {}) {
  const onSelect = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <SeverityCounters
        counts={{ CRITICAL: 1, WARNING: 3, SUGGESTION: 1 }}
        active={null}
        onSelect={onSelect}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onSelect };
}

describe("SeverityCounters", () => {
  it("shows a counter for each of the three levels, most severe first", () => {
    renderCounters();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "1 Critical",
      "3 Warning",
      "1 Suggestion",
    ]);
  });

  it("a level without findings shows 0 and cannot be clicked", () => {
    const { onSelect } = renderCounters({ counts: { CRITICAL: 0, WARNING: 2, SUGGESTION: 2 } });
    const critical = screen.getByRole("button", { name: "0 Critical" });
    expect(critical).toBeDisabled();
    fireEvent.click(critical);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking a level selects it", () => {
    const { onSelect } = renderCounters();
    fireEvent.click(screen.getByRole("button", { name: "3 Warning" }));
    expect(onSelect).toHaveBeenCalledWith("WARNING");
  });

  it("clicking the active level clears the filter", () => {
    const { onSelect } = renderCounters({ active: "WARNING" });
    fireEvent.click(screen.getByRole("button", { name: "3 Warning" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("clicking another level moves the selection to it", () => {
    const { onSelect } = renderCounters({ active: "WARNING" });
    fireEvent.click(screen.getByRole("button", { name: "1 Critical" }));
    expect(onSelect).toHaveBeenCalledWith("CRITICAL");
  });

  it("marks only the active level as pressed", () => {
    renderCounters({ active: "WARNING" });
    expect(screen.getByRole("button", { name: "3 Warning" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1 Critical" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "1 Suggestion" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("colours only the active level; the others stay neutral", () => {
    renderCounters({ active: "WARNING" });
    const warning = screen.getByRole("button", { name: "3 Warning" });
    expect(warning.style.borderColor).toBe("var(--warn)");
    expect(warning.style.color).toBe("var(--warn)");
    expect(warning.style.background).toBe("var(--warn-bg)");
    for (const name of ["1 Critical", "1 Suggestion"]) {
      const other = screen.getByRole("button", { name });
      expect(other.style.borderColor).toBe("var(--border-strong)");
      expect(other.style.color).toBe("var(--text-secondary)");
    }
  });

  it("all levels look the same when the filter is off", () => {
    renderCounters();
    for (const button of screen.getAllByRole("button")) {
      expect(button.style.borderColor).toBe("var(--border-strong)");
      expect(button.style.background).toBe("transparent");
    }
  });

  it("no level is pressed when the filter is off", () => {
    renderCounters();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });
});
