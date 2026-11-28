import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { ROUTE_RULE, renderWithIntl } from "../test-utils";
import { ConventionCard } from "./ConventionCard";

const URL = "https://github.com/acme/api/blob/main/src/routes/users.ts#L5-L6";

afterEach(cleanup);

function renderCard(over: Partial<typeof ROUTE_RULE> = {}) {
  const onStatus = vi.fn();
  const onRule = vi.fn();
  renderWithIntl(
    <ConventionCard convention={{ ...ROUTE_RULE, ...over }} githubUrl={URL} onStatus={onStatus} onRule={onRule} />,
  );
  return { onStatus, onRule };
}

describe("ConventionCard", () => {
  it("shows the rule, the evidence with a GitHub link, the snippet and the confidence", () => {
    renderCard();
    expect(screen.getByRole("button", { name: ROUTE_RULE.rule })).toBeInTheDocument();
    expect(screen.getByText("src/routes/users.ts:5-6")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open src/routes/users.ts:5-6 on GitHub" });
    expect(link).toHaveAttribute("href", URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(ROUTE_RULE.evidence_snippet)).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("accepts and rejects a pending candidate", () => {
    const { onStatus } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onStatus.mock.calls).toEqual([["accepted"], ["rejected"]]);
  });

  it("an accepted candidate shows Accepted; a click undoes the decision", () => {
    const { onStatus } = renderCard({ status: "accepted", accepted: true });
    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));
    expect(onStatus).toHaveBeenCalledWith("pending");
  });

  it("a rejected candidate stays, marked Rejected; a click undoes the decision", () => {
    const { onStatus } = renderCard({ status: "rejected" });
    expect(screen.getByRole("article")).toHaveStyle({ opacity: "0.6" });
    fireEvent.click(screen.getByRole("button", { name: "Rejected" }));
    expect(onStatus).toHaveBeenCalledWith("pending");
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("edits the rule inline and saves the trimmed text", () => {
    const { onRule } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: ROUTE_RULE.rule }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rule" }), { target: { value: "  Use getContext  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRule).toHaveBeenCalledWith("Use getContext");
  });

  it("does not save an empty or unchanged rule, and Cancel drops the edit", () => {
    const { onRule } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: ROUTE_RULE.rule }));
    const box = screen.getByRole("textbox", { name: "Rule" });
    fireEvent.change(box, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(box, { target: { value: ROUTE_RULE.rule } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Rule" })).toBeNull();
    expect(onRule).not.toHaveBeenCalled();
  });

  it("disables its buttons while its request is in flight", () => {
    renderWithIntl(
      <ConventionCard convention={ROUTE_RULE} githubUrl={URL} busy onStatus={vi.fn()} onRule={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });
});
