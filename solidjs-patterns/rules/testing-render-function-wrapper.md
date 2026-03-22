---
title: Wrap Components in Functions When Testing
impact: HIGH
impactDescription: tests fail or behave incorrectly without the function wrapper
tags: testing, vitest, solid-testing-library
---

## Wrap Components in Functions When Testing

**Impact: HIGH (tests fail or behave incorrectly without the function wrapper)**

SolidJS testing library's `render` expects a function returning JSX, not the JSX directly. This differs from React Testing Library. Without the wrapper, the component executes outside a reactive root and reactive updates won't work.

**Incorrect (React Testing Library pattern):**

```tsx
import { render, screen } from "@solidjs/testing-library";

it("renders greeting", () => {
  render(<Greeting name="World" />); // Wrong — passes JSX directly
  expect(screen.getByText("Hello, World!")).toBeInTheDocument();
});
```

**Correct (function wrapper):**

```tsx
import { render, screen } from "@solidjs/testing-library";

it("renders greeting", () => {
  render(() => <Greeting name="World" />); // Correct — arrow function
  expect(screen.getByText("Hello, World!")).toBeInTheDocument();
});
```

**Correct (testing reactive updates):**

```tsx
it("updates on click", async () => {
  const user = userEvent.setup();
  render(() => <Counter initial={0} />);

  const button = screen.getByRole("button");
  expect(button).toHaveTextContent("0");

  await user.click(button);
  expect(button).toHaveTextContent("1");
  // No rerender needed — signals drive updates automatically
});
```

There is no `rerender` in Solid's testing library. To test prop changes, use signals:

```tsx
it("reacts to prop changes", () => {
  const [name, setName] = createSignal("World");
  render(() => <Greeting name={name()} />);

  expect(screen.getByText("Hello, World!")).toBeInTheDocument();
  setName("Solid");
  expect(screen.getByText("Hello, Solid!")).toBeInTheDocument();
});
```

Reference: [SolidJS Docs - Testing](https://docs.solidjs.com/guides/testing)
