---
title: Scope Pending State to Each Async Action
impact: HIGH
impactDescription: "unrelated controls become disabled, causing blocked flows and stuck UI"
tags: state, async, pending, disabled, actions
---

## Scope Pending State to Each Async Action

**Impact: HIGH (unrelated controls become disabled, causing blocked flows and stuck UI)**

Avoid one shared `busy()` flag for a whole component when multiple async actions can overlap. A global flag couples unrelated controls and can block the very UI needed to finish the original task. Give each independent action its own pending signal, or use the pending state provided by `useSubmission()`, Solid Query mutations, or resources.

**Incorrect (one global busy flag disables unrelated actions):**

```typescript
const [busy, setBusy] = createSignal(false);

async function runInstall() {
  if (busy()) return;
  setBusy(true);
  try {
    await installPackage();
  } finally {
    setBusy(false);
  }
}

async function answerPermission(answer: "allow" | "deny") {
  if (busy()) return;
  setBusy(true);
  try {
    await respondToPermission(answer);
  } finally {
    setBusy(false);
  }
}

<button disabled={busy()} onClick={runInstall}>Install</button>
<button disabled={busy()} onClick={() => answerPermission("allow")}>Allow</button>
<button disabled={busy()} onClick={() => answerPermission("deny")}>Deny</button>
```

**Correct (pending state matches the action it protects):**

```typescript
const [installing, setInstalling] = createSignal(false);
const [respondingToPermission, setRespondingToPermission] = createSignal(false);

async function runInstall() {
  if (installing()) return;
  setInstalling(true);
  try {
    await installPackage();
  } finally {
    setInstalling(false);
  }
}

async function answerPermission(answer: "allow" | "deny") {
  if (respondingToPermission()) return;
  setRespondingToPermission(true);
  try {
    await respondToPermission(answer);
  } finally {
    setRespondingToPermission(false);
  }
}

<button disabled={installing()} onClick={runInstall}>Install</button>
<button disabled={respondingToPermission()} onClick={() => answerPermission("allow")}>Allow</button>
<button disabled={respondingToPermission()} onClick={() => answerPermission("deny")}>Deny</button>
```

**Correct (derive disabled state from specific dependencies):**

```typescript
const canSend = createMemo(() => prompt().trim().length > 0 && !sending());

<button disabled={!canSend()} onClick={sendMessage}>Send</button>
```

**Notes:**

- A shared pending flag is fine only when the operations are truly mutually exclusive
- Permission, confirmation, and cancellation UI should be disabled only by their own pending state
- Derive button state with a function or `createMemo()` instead of duplicating booleans
- For SolidStart form actions, prefer `action()` plus `useSubmission()` over hand-rolled pending state
