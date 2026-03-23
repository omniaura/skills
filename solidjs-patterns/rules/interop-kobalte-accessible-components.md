---
title: Use Kobalte for Accessible Interactive Components
impact: MEDIUM
impactDescription: hand-rolled dialogs/menus miss ARIA patterns — fails accessibility audits
tags: interop, accessibility, kobalte, a11y, components
---

## Use Kobalte for Accessible Interactive Components

**Impact: MEDIUM (hand-rolled dialogs/menus miss ARIA patterns — fails accessibility audits)**

Kobalte provides headless, WAI-ARIA compliant components for SolidJS. Use it for dialogs, menus, selects, popovers, tooltips, and tabs instead of building from scratch. Style states via `data-*` attribute selectors — Kobalte exposes `data-expanded`, `data-checked`, `data-highlighted`, etc.

**Incorrect (hand-rolled dialog — missing ARIA):**

```tsx
function Dialog(props: { open: boolean; children: JSX.Element }) {
  return (
    <Show when={props.open}>
      {/* ❌ No role, no aria-modal, no focus trapping, no ESC to close */}
      <div class="overlay">
        <div class="dialog">{props.children}</div>
      </div>
    </Show>
  );
}
```

**Correct (Kobalte Dialog — full ARIA compliance):**

```tsx
import { Dialog } from "@kobalte/core/dialog";

function MyDialog() {
  return (
    <Dialog>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/50" />
        <Dialog.Content class="fixed inset-0 m-auto max-w-md rounded-lg bg-white p-6">
          <Dialog.Title>Settings</Dialog.Title>
          <Dialog.Description>Update your preferences.</Dialog.Description>
          {/* Focus trapped, ESC closes, aria-modal set automatically */}
          <Dialog.CloseButton>Close</Dialog.CloseButton>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

**Styling component states with Tailwind:**

```tsx
// Install: @kobalte/tailwindcss for ui-* modifiers
<Accordion.Trigger class="ui-expanded:bg-blue-100 ui-expanded:font-bold">
  Section Title
</Accordion.Trigger>

// Or use data attributes directly
<Select.Item class="data-[highlighted]:bg-blue-100 data-[checked]:font-semibold">
  {item.label}
</Select.Item>
```

**When to use Kobalte vs custom components:**
- Dialogs, menus, selects, comboboxes, tabs → always Kobalte (complex ARIA)
- Buttons, links, simple inputs → native HTML elements suffice
- Toast notifications → Kobalte Toast (manages live region announcements)

Reference: [Kobalte Documentation](https://kobalte.dev/docs/core/overview/introduction/)
