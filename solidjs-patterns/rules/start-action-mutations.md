---
title: Use action() + useSubmission() for Form Mutations
impact: HIGH
impactDescription: No pending states, no optimistic UI, no progressive enhancement
tags: solidstart, action, useSubmission, mutations, forms, progressive-enhancement
---

## Use action() + useSubmission() for Form Mutations

**Impact: HIGH (no pending states, no optimistic UI, no progressive enhancement)**

SolidStart's `action()` wraps server functions for form mutations, giving you reactive pending/error state via `useSubmission()`, progressive enhancement (forms work without JS), and cache invalidation via `revalidate()`. Raw fetch/POST bypasses all of this.

**Incorrect (manual fetch — no pending state, no progressive enhancement):**

```typescript
import { createSignal } from "solid-js"

function AddTodoForm() {
  const [loading, setLoading] = createSignal(false)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.target as HTMLFormElement)
      await fetch("/api/todos", {
        method: "POST",
        body: JSON.stringify({ name: formData.get("name") }),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" />
      <button disabled={loading()}>{loading() ? "Adding..." : "Add"}</button>
    </form>
  )
}
```

**Correct (action + useSubmission — reactive pending, retry, clear):**

```typescript
import { Show } from "solid-js"
import { action, useSubmission } from "@solidjs/router"

const addTodo = action(async (formData: FormData) => {
  "use server"
  const name = formData.get("name")?.toString()
  if (!name || name.length < 2) {
    return { ok: false, message: "Name must be at least 2 characters." }
  }
  await db.insert("todos").values({ name })
  return { ok: true }
}, "addTodo")

function AddTodoForm() {
  const submission = useSubmission(addTodo)

  return (
    <form action={addTodo} method="post">
      <input name="name" />
      <button type="submit">{submission.pending ? "Adding..." : "Add"}</button>
      <Show when={!submission.result?.ok && submission.result?.message}>
        <p>{submission.result!.message}</p>
        <button onClick={() => submission.clear()}>Clear</button>
        <button onClick={() => submission.retry()}>Retry</button>
      </Show>
    </form>
  )
}
```

**Programmatic trigger with useAction():**

```typescript
import { action, useAction } from "@solidjs/router"

const addPost = action(async (title: string) => {
  "use server"
  await db.insert("posts").values({ title })
}, "addPost")

function Page() {
  const [title, setTitle] = createSignal("")
  const submit = useAction(addPost)

  return (
    <div>
      <input value={title()} onInput={(e) => setTitle(e.target.value)} />
      <button onClick={() => submit(title())}>Add Post</button>
    </div>
  )
}
```

**Cache invalidation after mutation:**

```typescript
import { action, revalidate, redirect } from "@solidjs/router";

const addPost = action(async (formData: FormData) => {
  "use server";
  await db.insert("posts").values({ title: formData.get("title") });
  revalidate(getPosts); // re-runs the getPosts query cache
}, "addPost");
```

Reference: [SolidStart Actions](https://docs.solidjs.com/solid-start/building-your-application/actions)
