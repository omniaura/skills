---
title: Use ARIA Live Regions for Dynamic Content Updates
impact: MEDIUM
impactDescription: Screen readers miss content changes from Show/For toggling
tags: accessibility, aria-live, dynamic-content, show, for, a11y
---

## Use ARIA Live Regions for Dynamic Content Updates

**Impact: MEDIUM (screen readers miss content changes from Show/For toggling)**

When content appears or changes dynamically via `<Show>` or `<For>`, screen readers don't announce it unless the container has `aria-live`. Without it, users relying on assistive technology miss updates entirely.

**Incorrect (dynamic content with no screen reader announcement):**

```typescript
function Notifications(props: { items: string[] }) {
  return (
    <div>
      <Show when={props.items.length > 0}>
        <ul>
          <For each={props.items}>{(item) => <li>{item}</li>}</For>
        </ul>
      </Show>
    </div>
  )
  // Screen reader users never learn new notifications appeared
}
```

**Correct (aria-live announces dynamic changes):**

```typescript
function Notifications(props: { items: string[] }) {
  return (
    <div aria-live="polite" role="status">
      <Show
        when={props.items.length > 0}
        fallback={<p>No notifications</p>}
      >
        <ul aria-label="Notifications">
          <For each={props.items}>{(item) => <li>{item}</li>}</For>
        </ul>
      </Show>
    </div>
  )
}
```

**For expandable sections, use aria-expanded on the trigger:**

```typescript
function ExpandableSection(props: { title: string; children: JSX.Element }) {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div>
      <button
        aria-expanded={expanded()}
        aria-controls="section-content"
        onClick={() => setExpanded(!expanded())}
      >
        {props.title}
      </button>
      <Show when={expanded()}>
        <div id="section-content" role="region" aria-label={props.title}>
          {props.children}
        </div>
      </Show>
    </div>
  )
}
```

**Guidelines:**

- `aria-live="polite"` — announces after current speech finishes (most cases)
- `aria-live="assertive"` — interrupts current speech (errors, urgent alerts only)
- `role="status"` — implicit `aria-live="polite"` for status messages
- `role="alert"` — implicit `aria-live="assertive"` for error messages
- Always provide `aria-label` on `<ul>` / `<ol>` rendered inside `<For>`
- For complex widgets (dialogs, tabs), use Kobalte instead (see component-accessible-dialog)

Reference: [WAI-ARIA Live Regions](https://www.w3.org/WAI/ARIA/apd/#live_region)
