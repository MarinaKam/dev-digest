import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/addRepo.json";
import { ApiError } from "@/lib/api";

const push = vi.hoisted(() => vi.fn());
const mutateAsync = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/hooks/repos", () => ({
  useAddRepo: () => ({ mutateAsync, isPending: false }),
}));

import { AddRepoView } from "./AddRepoView";

beforeEach(() => {
  push.mockClear();
  mutateAsync.mockReset();
});
afterEach(cleanup);

function renderView() {
  render(
    <NextIntlClientProvider locale="en" messages={{ addRepo: messages }}>
      <AddRepoView />
    </NextIntlClientProvider>,
  );
  return {
    input: screen.getByPlaceholderText("https://github.com/owner/repo"),
    submit: screen.getByRole("button", { name: "Add repository" }),
  };
}

describe("AddRepoView", () => {
  it("cannot be submitted while the URL is empty or blank", () => {
    const { input, submit } = renderView();
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    expect(submit).toBeDisabled();
  });

  it("adds the trimmed URL and opens the new repo's PR list", async () => {
    mutateAsync.mockResolvedValue({ id: "repo-9" });
    const { input, submit } = renderView();
    fireEvent.change(input, { target: { value: "  https://github.com/acme/api  " } });
    fireEvent.click(submit);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/repos/repo-9/pulls"));
    expect(mutateAsync).toHaveBeenCalledWith("https://github.com/acme/api");
  });

  it("shows the server's message when the repo cannot be added, and stays on the screen", async () => {
    mutateAsync.mockRejectedValue(new ApiError("Repository not found", 404));
    const { input, submit } = renderView();
    fireEvent.change(input, { target: { value: "https://github.com/acme/missing" } });
    fireEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Repository not found");
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for an unknown failure", async () => {
    mutateAsync.mockRejectedValue(new Error("boom"));
    const { input, submit } = renderView();
    fireEvent.change(input, { target: { value: "https://github.com/acme/api" } });
    fireEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add repository");
  });

  it("closes on Escape", () => {
    renderView();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("links to the API key settings", () => {
    renderView();
    expect(screen.getByRole("link", { name: "Settings → API Keys" })).toHaveAttribute(
      "href",
      "/settings/api-keys",
    );
  });
});
