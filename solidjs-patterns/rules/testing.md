# Testing and migration checks

**Impact: HIGH**

Target the real Solid 2 compiler/runtime, not a Solid 1 JSX transform with updated package types. Use `@solidjs/vite-plugin` (default export), `jsxImportSource: "@solidjs/web"`, and `@solidjs/testing-library@1.0.0-rc.2`. Use Vitest with a DOM environment for components; `bun test` alone does not apply Vite's JSX compiler. This repository's `bun run test` invokes Vitest.

```tsx
import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { Counter } from "./reactivity-0";

afterEach(cleanup);

test("counter updates after the deferred write", async () => {
  render(() => <Counter />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("button").textContent).toBe("2"));
});
```

The import above names this repository's generated example module; in an application, import your actual component. Use `flush()` for deliberately synchronous signal assertions; prefer `findBy*`/`waitFor` for DOM, query observers, and async work. Read signals outside component setup to test old-before-flush/new-after-flush semantics. Dispose roots/rendered components and clear each test's QueryClient; turn retries off for failure cases. `onSettled` is not a license for async callbacks returning promises; launch async work with explicit error handling.

Test the behavior, not just successful compilation:

- A split effect cleans up on dependency replacement and unmount, exactly once per subscription.
- Ref factory listeners stop firing after disposal, even when retaining the detached DOM node.
- Initial async data shows a **local** loading state; invalidation retains stale content and later displays fresh data without a fallback flash.
- Disabled/no-cache queries render the status-guard fallback instead of suspending indefinitely.
- Cache optimism paints before the server promise settles; a rejected write restores the snapshot. Awaited `onSuccess` invalidation keeps pending until fresh data lands.
- Stable keyed rows preserve instances when objects are replaced; optimistic actions revert overlays on settlement.

When migrating, run `solid-migration-assistant@0.2.1` first, but note its source-only scan skips Markdown samples and targets an earlier RC. Follow up with typecheck, compiled sample tests, and relevant browser integration checks. Do not weaken assertions or add blanket suppressions to force a green run. Verify emitted browser imports reference `@solidjs/web`, not `solid-js/web`.

## Validation in this repository

`bun run build` compiles `AGENTS.md` from the ordered `rules/` files and extracts each TS/TSX block into `.generated/`. `bun run typecheck` checks those exact examples plus the validation harness. `bun run test` builds first and exercises selected generated examples with the Solid 2 Vite compiler. `bun run build:check` rejects drift between the rules and the checked-in reference. Edit the rules, not `AGENTS.md` by hand.

This skill is not a server framework guide. Validate SSR/router integrations against their own Solid 2 releases before recommending APIs; do not silently introduce SolidStart or backend changes into an SPA migration.
