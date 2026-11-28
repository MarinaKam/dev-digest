/* Route error boundary for the whole app: an exception thrown while a screen
   renders lands here instead of on the framework's default page. It does not
   render AppShell on purpose — if the shell is what threw, rendering it again
   would only throw again. Load errors of a single query are not handled here:
   a view shows those itself, with ErrorState. */
"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@devdigest/ui";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  const t = useTranslations("errors");
  return <ErrorState fullScreen title={t("unexpectedTitle")} body={t("unexpectedBody")} onRetry={reset} />;
}
