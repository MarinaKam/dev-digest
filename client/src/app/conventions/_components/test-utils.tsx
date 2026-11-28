import type React from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import { ToastProvider } from "@/lib/toast";
import conventions from "../../../../messages/en/conventions.json";
import skills from "../../../../messages/en/skills.json";

export const ROUTE_RULE: ConventionCandidate = {
  id: "c1",
  repo_id: "r1",
  rule: "Read the workspace from getContext in every route",
  evidence_path: "src/routes/users.ts",
  evidence_snippet: "const { workspaceId } = await getContext(app.container, req);",
  evidence_line_start: 5,
  evidence_line_end: 6,
  confidence: 0.9,
  accepted: false,
  status: "pending",
};

export const ERROR_RULE: ConventionCandidate = {
  ...ROUTE_RULE,
  id: "c2",
  rule: "Throw NotFoundError for a missing record",
  evidence_path: "src/services/user.service.ts",
  evidence_snippet: "if (!id) throw new NotFoundError('User not found');",
  evidence_line_start: 3,
  evidence_line_end: 3,
  confidence: 0.7,
};

export function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ conventions, skills }}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>,
  );
}
