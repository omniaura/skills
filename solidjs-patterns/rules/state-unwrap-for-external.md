---
title: Use unwrap() When Passing Stores to Third-Party Libraries
impact: MEDIUM
impactDescription: third-party code fails or behaves unexpectedly with Proxy objects
tags: state, store, unwrap, interop, proxy
---

## Use unwrap() When Passing Stores to Third-Party Libraries

**Impact: MEDIUM (third-party code fails or behaves unexpectedly with Proxy objects)**

SolidJS stores are JavaScript `Proxy` objects. Some third-party libraries (charting, serialization, validation, deep-clone utilities) don't work correctly with proxies — they may skip properties, throw errors, or produce incorrect results. Use `unwrap()` to get a plain JavaScript object before passing store data to external code.

**Incorrect (passing proxy to external library):**

```typescript
import { createStore } from "solid-js/store";
import { cloneDeep } from "lodash-es";
import Ajv from "ajv";

const [formState, setFormState] = createStore({ name: "", email: "" });

// ❌ cloneDeep may not traverse Proxy properties correctly
const snapshot = cloneDeep(formState);

// ❌ JSON schema validator may miss Proxy-wrapped fields
const ajv = new Ajv();
const valid = ajv.validate(schema, formState);

// ❌ structuredClone throws on Proxy objects
const copy = structuredClone(formState);
```

**Correct (unwrap before passing to external code):**

```typescript
import { createStore, unwrap } from "solid-js/store";
import { cloneDeep } from "lodash-es";

const [formState, setFormState] = createStore({ name: "", email: "" });

// ✅ Get plain object first
const plain = unwrap(formState);
const snapshot = cloneDeep(plain);
const valid = ajv.validate(schema, plain);
const copy = structuredClone(plain);

// ✅ Also useful for sending to APIs
await fetch("/api/submit", {
  method: "POST",
  body: JSON.stringify(unwrap(formState)),
});
```

**When you DON'T need unwrap:**
- Passing stores to other SolidJS components (they understand proxies)
- Reading store properties in JSX or effects (reactivity works through proxies)
- Using `produce()` or `reconcile()` (they work with proxies natively)

**Note:** `unwrap()` returns a shallow reference to the underlying data — it does NOT clone. Mutations to the unwrapped object will affect the store.

Reference: [SolidJS unwrap](https://docs.solidjs.com/reference/store-utilities/unwrap)
