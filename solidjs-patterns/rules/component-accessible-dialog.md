---
title: Use Kobalte for Accessible Interactive Widgets
impact: MEDIUM-HIGH
impactDescription: Missing focus trapping, ARIA roles, keyboard navigation
tags: accessibility, kobalte, dialog, a11y, focus-management
---

## Use Kobalte for Accessible Interactive Widgets

**Impact: MEDIUM-HIGH (missing focus trapping, ARIA roles, keyboard navigation)**

Complex interactive widgets (dialogs, selects, comboboxes, tabs, menus) require WAI-ARIA patterns, focus trapping, keyboard navigation, and screen reader announcements. Kobalte (`@kobalte/core`) handles all of this for SolidJS. Rolling your own is error-prone and incomplete.

**Incorrect (DIY modal — no focus trap, no ARIA, no keyboard handling):**

```typescript
function Modal(props: { open: boolean; onClose: () => void; children: JSX.Element }) {
  return (
    <Show when={props.open}>
      <div class="overlay" onClick={props.onClose}>
        <div class="modal" onClick={(e) => e.stopPropagation()}>
          <button onClick={props.onClose}>X</button>
          {props.children}
        </div>
      </div>
    </Show>
  )
}
// Missing: role="dialog", aria-modal, focus trap, Escape key,
// focus restoration, scroll lock, aria-labelledby
```

**Correct (Kobalte Dialog — complete accessibility out of the box):**

```typescript
import { Dialog } from "@kobalte/core/dialog"

function Modal(props: { children: JSX.Element }) {
  return (
    <Dialog>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/50" />
        <Dialog.Content class="fixed inset-0 m-auto max-w-lg rounded-lg bg-white p-6">
          <Dialog.Title>Confirm Action</Dialog.Title>
          <Dialog.Description>This will apply changes.</Dialog.Description>
          {props.children}
          <Dialog.CloseButton>Close</Dialog.CloseButton>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
```

**Kobalte Dialog provides automatically:**

- `role="dialog"` and `aria-modal="true"`
- Focus trapping within the dialog
- Escape key closes the dialog
- Focus restores to the trigger on close
- Scroll locking on the body
- Click-outside dismissal

**Import from subpaths (barrel import is deprecated):**

```typescript
// Correct
import { Dialog } from "@kobalte/core/dialog";
import { Select } from "@kobalte/core/select";
import { Tabs } from "@kobalte/core/tabs";

// Wrong — deprecated barrel export
import { Dialog } from "@kobalte/core";
```

**Key points:**

- Kobalte is unstyled — zero CSS shipped, bring your own styles or use shadcn-solid
- Use Kobalte for: Dialog, Select, Combobox, Tabs, Menu, Toast, Popover, Tooltip
- For simple toggles, manual `aria-expanded` + `role="region"` is fine (see component-aria-live-dynamic)

Reference: [Kobalte Documentation](https://kobalte.dev)
