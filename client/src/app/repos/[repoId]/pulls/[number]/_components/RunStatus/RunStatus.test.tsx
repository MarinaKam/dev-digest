import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";

const stream = vi.hoisted(() => ({ running: false }));

vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: stream.running }),
}));

import { RunStatus } from "./RunStatus";

beforeEach(() => {
  stream.running = false;
});
afterEach(cleanup);

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("RunStatus", () => {
  it("renders nothing when there are no run ids", () => {
    const { container } = render(withIntl(<RunStatus runIds={[]} />));
    expect(container.firstChild).toBeNull();
  });

  it("does not report done for a stream that never ran", () => {
    const onDone = vi.fn();
    render(withIntl(<RunStatus runIds={["run-1"]} onDone={onDone} />));
    expect(onDone).not.toHaveBeenCalled();
  });

  it("reports done once when the stream ends, however often the parent re-renders", () => {
    const onDone = vi.fn();
    // The parent passes a new function on every render, as an inline handler does.
    const ui = () => withIntl(<RunStatus runIds={["run-1"]} onDone={() => onDone()} />);

    stream.running = true;
    const { rerender } = render(ui());
    expect(onDone).not.toHaveBeenCalled();

    stream.running = false;
    rerender(ui());
    expect(onDone).toHaveBeenCalledTimes(1);

    rerender(ui());
    rerender(ui());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("reports done again for the next stream", () => {
    const onDone = vi.fn();
    const ui = () => withIntl(<RunStatus runIds={["run-1"]} onDone={() => onDone()} />);

    stream.running = true;
    const { rerender } = render(ui());
    stream.running = false;
    rerender(ui());
    stream.running = true;
    rerender(ui());
    stream.running = false;
    rerender(ui());

    expect(onDone).toHaveBeenCalledTimes(2);
  });
});
