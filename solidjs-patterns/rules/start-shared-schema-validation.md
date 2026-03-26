---
title: Share Validation Schema Between Client Form and Server Action
impact: HIGH
impactDescription: "duplicated validation logic or missed server-side checks"
tags: solidstart, forms, validation, zod, valibot
---

## Share Validation Schema Between Client Form and Server Action

**Impact: HIGH (duplicated validation logic or missed server-side checks)**

Define a single Zod or Valibot schema in a shared module and use it for both client-side form validation and server-side action validation. This eliminates duplication and ensures the server never accepts data the client would reject (or vice versa).

**Incorrect (duplicated or missing validation):**

```typescript
// BAD: client has its own rules, server has different (or no) validation
function ContactForm() {
  const [email, setEmail] = createSignal("")

  // Client-only check — server trusts blindly
  const valid = () => email().includes("@")

  return <form action={submitContact} method="post">
    <input name="email" onInput={e => setEmail(e.target.value)} />
    <Show when={!valid()}><span>Invalid email</span></Show>
    <button>Submit</button>
  </form>
}

const submitContact = action(async (formData: FormData) => {
  "use server"
  // BAD: no validation — trusts client input
  const email = formData.get("email") as string
  await db.insert("contacts").values({ email })
})
```

**Correct (shared schema validates both sides):**

```typescript
// src/schemas/contact.ts — shared between client and server
import { z } from "zod"

export const ContactSchema = z.object({
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message too short").max(1000),
})

// src/routes/contact.tsx — client form with shared validation
import { createForm, zodForm } from "@modular-forms/solid"
import { ContactSchema } from "~/schemas/contact"

function ContactForm() {
  const [form, { Form, Field }] = createForm({
    validate: zodForm(ContactSchema),
  })

  return (
    <Form action={submitContact}>
      <Field name="email">
        {(field, props) => (
          <div>
            <input {...props} />
            <Show when={field.error}><span>{field.error}</span></Show>
          </div>
        )}
      </Field>
      <Field name="message">
        {(field, props) => (
          <div>
            <textarea {...props} />
            <Show when={field.error}><span>{field.error}</span></Show>
          </div>
        )}
      </Field>
      <button type="submit">Send</button>
    </Form>
  )
}

// Server action reuses the same schema
const submitContact = action(async (formData: FormData) => {
  "use server"
  const result = ContactSchema.safeParse(Object.fromEntries(formData))
  if (!result.success) throw new Error(result.error.issues[0].message)
  await db.insert("contacts").values(result.data)
})
```

Key rules:
- Put schemas in a shared module (e.g., `src/schemas/`)
- Use `safeParse` on the server to return structured errors
- Never trust client validation alone — always validate server-side
- Works with Zod, Valibot, or any schema library with form adapters

Reference: [Modular Forms SolidJS Guide](https://modularforms.dev/solid/guides/introduction)
