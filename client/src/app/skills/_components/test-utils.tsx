/* Test helpers shared by the Skills screen's component tests. */
import type React from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import { ToastProvider } from "@/lib/toast";
import messages from "../../../../messages/en/skills.json";

export const SKILL: Skill = {
  id: "sk1",
  name: "edge-case-coverage",
  description: "Flag every new branch that no test reaches.",
  type: "rubric",
  source: "manual",
  body: "# Rule\nCheck the branches.",
  enabled: true,
  version: 1,
  injection_flags: [],
  used_by: [
    { id: "ag1", name: "Test Quality" },
    { id: "ag2", name: "General" },
  ],
};

export function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(ui: React.ReactElement) {
  return render(withIntl(ui));
}
