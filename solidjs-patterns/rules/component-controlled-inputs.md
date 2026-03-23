---
title: Bind Both value and onInput for Controlled Inputs
impact: HIGH
impactDescription: inputs appear controlled but user can type freely — state and UI diverge
tags: components, forms, controlled, input, binding
---

## Bind Both value and onInput for Controlled Inputs

**Impact: HIGH (inputs appear controlled but user can type freely — state and UI diverge)**

Unlike React, setting `value={signal()}` on an input does NOT make it controlled in SolidJS. Since SolidJS doesn't re-render the component, the DOM input keeps its own state. For true controlled behavior, you MUST bind both `value` and an input handler.

**Incorrect (value alone — NOT controlled):**

```tsx
function SearchBox() {
  const [query, setQuery] = createSignal("");
  // ❌ User can type anything — the input ignores the signal
  return <input value={query()} />;
}
```

**Correct (value + onInput — truly controlled):**

```tsx
function SearchBox() {
  const [query, setQuery] = createSignal("");
  return (
    <input
      value={query()}
      onInput={(e) => setQuery(e.currentTarget.value)}
    />
  );
}

// With validation/transformation:
function PhoneInput() {
  const [phone, setPhone] = createSignal("");
  return (
    <input
      value={phone()}
      onInput={(e) => {
        // Strip non-digits — input reflects only valid characters
        setPhone(e.currentTarget.value.replace(/\D/g, ""));
      }}
    />
  );
}
```

**Checkboxes and selects follow the same pattern:**

```tsx
// Checkbox
<input
  type="checkbox"
  checked={isEnabled()}
  onChange={(e) => setIsEnabled(e.currentTarget.checked)}
/>

// Select
<select
  value={selected()}
  onChange={(e) => setSelected(e.currentTarget.value)}
>
  <option value="a">A</option>
  <option value="b">B</option>
</select>
```

**Note:** File inputs (`<input type="file">`) cannot be controlled — their `value` is read-only for security reasons. Use `onChange` to capture the selected file.

Reference: [SolidJS Docs - Control Flow](https://docs.solidjs.com/concepts/control-flow)
