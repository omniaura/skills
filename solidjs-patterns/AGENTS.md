# SolidJS Patterns — Complete Rule Reference

> **102 rules** across 9 sections, ordered by impact.

---

# 1. Reactivity Correctness

**Impact: CRITICAL** — SolidJS's fine-grained reactivity is its core advantage but also the #1 source of bugs. Signals must be read inside reactive contexts, stores must not be destructured, and tracking scopes must be understood. Getting reactivity wrong silently breaks your UI.

## Never Use async/await Inside createEffect

**Impact: HIGH (signal reads after await silently lose tracking — effects never re-run)**

After the first `await` inside `createEffect`, the synchronous tracking context is destroyed. Any signal reads after `await` will NOT register as dependencies — the effect will never re-run when those signals change. This is one of the most common silent bugs in SolidJS.

**Incorrect (tracking lost after await):**

```tsx
createEffect(async () => {
  const id = userId();        // ✅ tracked (before await)
  const data = await fetchUser(id);
  const format = outputFormat(); // ❌ NOT tracked (after await)
  setDisplay(formatUser(data, format));
});
// Effect re-runs when userId changes, but NOT when outputFormat changes
```

**Correct (separate the async work from the tracking):**

```tsx
// Option 1: Track all signals before the await
createEffect(() => {
  const id = userId();
  const format = outputFormat(); // ✅ tracked (before await)
  fetchUser(id).then(data => {
    setDisplay(formatUser(data, format));
  });
});

// Option 2: Use createResource / createAsync for async data
const user = createAsync(() => fetchUser(userId()));
// Then derive from user() and outputFormat() in a memo or JSX
```

**Why this happens:** SolidJS tracks signal reads synchronously during function execution. `await` suspends execution and resumes in a microtask where the tracking scope no longer exists. This is fundamental to how JavaScript async works — not a SolidJS bug.

**Rule of thumb:** If you need `await` in an effect, restructure so ALL signal reads happen before the first `await`, or use `createResource`/`createAsync` instead.

Reference: [SolidJS Docs - createEffect](https://docs.solidjs.com/reference/basic-reactivity/create-effect)

## batch() Only Batches Synchronous Updates

**Impact: MEDIUM (updates after await bypass batching — unexpected intermediate renders)**

`batch()` defers subscriber notifications until the callback completes, but only for synchronous code. If the callback is async, updates after the first `await` are applied immediately and individually — defeating the purpose of batching.

**Incorrect (async batch — updates after await are NOT batched):**

```tsx
batch(async () => {
  setName("Alice");       // ✅ batched
  setAge(30);             // ✅ batched
  const data = await fetchProfile();
  setEmail(data.email);   // ❌ applied immediately (not batched)
  setAvatar(data.avatar); // ❌ applied immediately (separate update)
});
```

**Correct (batch only synchronous updates):**

```tsx
// Option 1: Fetch first, batch the sync updates
const data = await fetchProfile();
batch(() => {
  setName(data.name);
  setAge(data.age);
  setEmail(data.email);
  setAvatar(data.avatar);
});

// Option 2: Use a store with reconcile (single update)
const [profile, setProfile] = createStore(initialProfile);
const data = await fetchProfile();
setProfile(reconcile(data));
```

**Also note:** Reading a signal inside `batch()` after setting it returns the OLD value (pre-batch), since updates are deferred:

```tsx
batch(() => {
  setCount(5);
  console.log(count()); // Still the old value, not 5
});
// After batch completes, count() returns 5
```

Reference: [SolidJS Docs - batch](https://docs.solidjs.com/reference/reactive-utilities/batch)

## Batch Multiple Signal Updates to Prevent Intermediate Renders

**Impact: MEDIUM (unnecessary intermediate re-renders when updating multiple signals)**

When updating multiple signals in event handlers or callbacks, wrap them in `batch()` to coalesce notifications. Solid automatically batches updates inside effects and store setters, but event handlers and async callbacks run outside the reactive system.

**Incorrect (each setter triggers a separate update cycle):**

```typescript
const handleSubmit = () => {
  setName("John")       // triggers re-render 1
  setEmail("j@test.com") // triggers re-render 2
  setSubmitted(true)     // triggers re-render 3
}
```

**Correct (single update cycle for all changes):**

```typescript
import { batch } from "solid-js"

const handleSubmit = () => {
  batch(() => {
    setName("John")
    setEmail("j@test.com")
    setSubmitted(true)
    // All three updates applied, then ONE re-render
  })
}
```

**Where batching is automatic (no need for manual `batch()`):**

```typescript
// Inside createEffect — already batched
createEffect(() => {
  setA(b())
  setC(d())  // batched with setA
})

// Inside store setters — already batched
setState(produce(s => {
  s.name = "John"
  s.email = "j@test.com"  // batched
}))
```

**Where you DO need manual `batch()`:**

```typescript
// Event handlers
<button onClick={() => batch(() => { setX(1); setY(2) })}>

// setTimeout / setInterval
setTimeout(() => batch(() => { setA(1); setB(2) }), 1000)

// Promise callbacks
fetch(url).then(data => batch(() => {
  setData(data)
  setLoading(false)
}))
```

**Notes:**
- `batch` returns the return value of the callback, so you can use it inline: `const result = batch(() => { ... })`
- For 2+ signal updates in the same event handler, `batch` is a no-brainer micro-optimization
- Store `setState` already batches internally — no need to wrap store updates

Reference: [SolidJS batch](https://docs.solidjs.com/reference/reactive-utilities/batch)

## Chain createMemo for Multi-Step Derived State

**Impact: MEDIUM (prevents redundant recomputation in derived state chains)**

When derived state has multiple stages (filter → sort → count), chain `createMemo` calls so each intermediate result is cached independently. Downstream memos only recompute when their specific input changes.

**Incorrect (single monolithic derivation):**

```tsx
// Recomputes everything when any signal changes
const result = createMemo(() => {
  const filtered = items().filter((i) => i.category === filter());
  const sorted = filtered.sort((a, b) => a[sortBy()] - b[sortBy()]);
  return { items: sorted, count: sorted.length };
});
```

**Correct (chained memos with independent caching):**

```tsx
const filteredItems = createMemo(() =>
  items().filter((i) => i.category === filter())
);

const sortedItems = createMemo(() =>
  [...filteredItems()].sort((a, b) => a[sortBy()] - b[sortBy()])
);

const itemCount = createMemo(() => filteredItems().length);
```

Now when `sortBy` changes, only `sortedItems` recomputes — `filteredItems` and `itemCount` are cached. When `filter` changes, `filteredItems` recomputes first, then `sortedItems` and `itemCount` update only if the filtered result actually changed.

Reference: [SolidJS Docs - createMemo](https://docs.solidjs.com/reference/basic-reactivity/create-memo)

## Always Clean Up Effects with onCleanup

**Impact: HIGH (memory leaks from unremoved listeners, timers, subscriptions)**

Effects re-run when dependencies change. Without cleanup, each re-run adds another listener/timer. Components unmounting without cleanup leave orphaned subscriptions.

**Incorrect (listener never removed):**

```typescript
createEffect(() => {
  window.addEventListener("resize", handleResize)
})
```

**Correct (cleanup on re-run and unmount):**

```typescript
createEffect(() => {
  window.addEventListener("resize", handleResize)
  onCleanup(() => window.removeEventListener("resize", handleResize))
})
```

Always clean up: event listeners, setInterval/setTimeout, WebSocket connections, ResizeObserver/IntersectionObserver, and any subscriptions.

Reference: [SolidJS onCleanup](https://docs.solidjs.com/reference/lifecycle/on-cleanup)

## Use createComputed for synchronous pre-render derived state

**Impact: MEDIUM — stale derived values visible during first render**

`createComputed` runs synchronously *before* render when dependencies change, unlike `createEffect` which runs *after*. Use it when derived state must be available immediately — not lazily like `createMemo`.

**Incorrect (using createEffect for state that must be ready before render):**

```typescript
import { createSignal, createEffect } from "solid-js"

function UserGreeting() {
  const [firstName, setFirstName] = createSignal("John")
  const [lastName, setLastName] = createSignal("Doe")

  // ❌ createEffect runs AFTER render — greeting is stale on first paint
  let greeting = ""
  createEffect(() => {
    greeting = `Hello, ${firstName()} ${lastName()}!`
  })

  return <h1>{greeting}</h1> // Shows empty string on first render
}
```

**Correct (createComputed updates before render):**

```typescript
import { createSignal, createComputed } from "solid-js"

function UserGreeting() {
  const [firstName, setFirstName] = createSignal("John")
  const [lastName, setLastName] = createSignal("Doe")

  // ✅ createComputed runs BEFORE render — value is always in sync
  let greeting = ""
  createComputed(() => {
    greeting = `Hello, ${firstName()} ${lastName()}!`
  })

  return <h1>{greeting}</h1> // Shows "Hello, John Doe!" immediately
}
```

**When to prefer `createMemo` instead**: Most derived state should use `createMemo` — it's lazy, cached, and returns a signal. Only use `createComputed` when you need synchronous assignment to an external variable before render.

```typescript
// ✅ Prefer createMemo for most cases
const greeting = createMemo(() => `Hello, ${firstName()} ${lastName()}!`)
return <h1>{greeting()}</h1>
```

Reference: [SolidJS API — createComputed](https://docs.solidjs.com/reference/basic-reactivity/create-computed)

## Use createDeferred for Expensive Computations on Rapid Input

**Impact: MEDIUM (prevents UI jank during rapid updates)**

`createDeferred` creates a signal that only updates when the browser is idle, preventing expensive re-computations from blocking user input. Use it instead of manual debouncing for reactive values.

**Incorrect (expensive computation runs on every keystroke):**

```typescript
const [searchTerm, setSearchTerm] = createSignal("")

// Runs expensive filter on EVERY keystroke — blocks UI
const results = createMemo(() =>
  allItems().filter(item =>
    item.name.toLowerCase().includes(searchTerm().toLowerCase())
  )
)
```

**Correct (deferred signal delays expensive computation):**

```typescript
import { createDeferred } from "solid-js"

const [searchTerm, setSearchTerm] = createSignal("")
const deferredSearch = createDeferred(searchTerm, { timeoutMs: 250 })

// Only re-runs when browser is idle or after 250ms timeout
const results = createMemo(() =>
  allItems().filter(item =>
    item.name.toLowerCase().includes(deferredSearch().toLowerCase())
  )
)
```

**Notes:**
- `createDeferred` uses `requestIdleCallback` internally, falling back to the timeout
- Keeps the input responsive while deferring expensive downstream computations
- Prefer over manual `setTimeout`/debounce patterns for reactive values

## Use createReaction to Separate Tracking from Side Effects

**Impact: LOW (fine-grained control over effect triggers)**

`createReaction` separates what you track from what happens when it changes. The tracking function defines dependencies; the reaction function runs when they change. Useful when you want to observe only specific properties of a complex signal.

**Incorrect (effect tracks more dependencies than needed):**

```typescript
createEffect(() => {
  // Tracks ALL properties of user() — re-runs on any change
  console.log("User ID changed:", user().id)
})
```

**Correct (track only what matters):**

```typescript
import { createReaction } from "solid-js"

const track = createReaction(() => {
  console.log("User ID changed:", user().id)
})

// Only re-runs when user().id changes, not on other user property changes
track(() => user().id)
```

**Notes:**
- The tracking function (passed to `track()`) defines which signals to observe
- The reaction function (passed to `createReaction()`) runs when tracked signals change
- Useful for preventing unnecessary effect re-runs on complex objects

## Derive State with Functions or Memos, Not Effects

**Impact: HIGH (unnecessary re-renders, potential infinite loops, and harder-to-trace data flow)**

When one value depends on another, derive it as a plain function or `createMemo` — never synchronize signals with `createEffect`. Effects are for side effects (DOM manipulation, logging, network requests), not for keeping state in sync.

**Incorrect (syncing state with an effect):**

```typescript
const [firstName, setFirstName] = createSignal("John")
const [lastName, setLastName] = createSignal("Doe")
const [fullName, setFullName] = createSignal("")

// BAD: effect creates a hidden data flow, extra signal, extra re-render
createEffect(() => {
  setFullName(`${firstName()} ${lastName()}`)
})
```

**Correct (cheap derivation — plain function):**

```typescript
const [firstName, setFirstName] = createSignal("John")
const [lastName, setLastName] = createSignal("Doe")

// GOOD: plain function — zero overhead, recalculates when called in tracked scope
const fullName = () => `${firstName()} ${lastName()}`
```

**Correct (expensive derivation — createMemo):**

```typescript
const [items, setItems] = createSignal<Item[]>([])
const [filter, setFilter] = createSignal("")

// GOOD: createMemo caches result, only recomputes when dependencies change
const filteredItems = createMemo(() =>
  items().filter(item => item.name.includes(filter()))
)
```

**When to use which:**

| Scenario | Use |
|----------|-----|
| Simple property access, string concat, math | Plain function `() => ...` |
| Filtering, sorting, mapping large arrays | `createMemo` |
| Side effects (fetch, DOM, logging) | `createEffect` |

**Notes:**
- Plain functions in SolidJS are naturally reactive when called inside JSX or effects — they re-evaluate when their signal dependencies change
- `createMemo` adds caching — use it when the computation is expensive or accessed in multiple places
- If you find yourself writing `createEffect(() => setX(...))`, it's almost always a sign you should use a derived function or memo instead

Reference: [SolidJS Derived Signals](https://docs.solidjs.com/concepts/derived-values/derived-signals)

## Never Destructure Props

**Impact: CRITICAL (silent reactivity loss — UI stops updating)**

SolidJS components run once, not per-render. Destructuring props captures values at creation time — they never update.

**Incorrect (destructured props lose reactivity):**

```typescript
function Badge({ count, color }: BadgeProps) {
  return <span style={{ color }}>{count}</span>
}
// count and color are captured once — never update when parent passes new values
```

**Correct (access props directly or use splitProps/mergeProps):**

```typescript
function Badge(props: BadgeProps) {
  return <span style={{ color: props.color }}>{props.count}</span>
}

// With defaults:
function Badge(props: BadgeProps) {
  const merged = mergeProps({ color: "blue" }, props)
  return <span style={{ color: merged.color }}>{merged.count}</span>
}

// With prop separation:
function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ["variant"])
  return <span class={local.variant === "primary" ? "btn-primary" : "btn"} {...rest} />
}
```

Reference: [SolidJS Props Documentation](https://docs.solidjs.com/concepts/components/props)

## Never Mutate Store Values Directly

**Impact: CRITICAL (mutations silently ignored — UI doesn't update)**

Store proxies track reads and writes through the setter function. Direct mutation bypasses the proxy and triggers nothing.

**Incorrect (direct mutation — no update triggered):**

```typescript
const [state, setState] = createStore({ items: [] })

state.items.push(newItem) // Won't trigger reactivity!
```

**Correct (use setter or produce):**

```typescript
// Path-based setter
setState("items", items => [...items, newItem])

// Or produce for complex mutations
import { produce } from "solid-js/store"

setState(produce(state => {
  state.items.push(newItem)
  state.count++
}))
```

Reference: [SolidJS Stores](https://docs.solidjs.com/concepts/stores)

## Don't Assume Effect Execution Order

**Impact: HIGH (intermittent bugs from effects running in unexpected order)**

Effects run when their dependencies change, not in source code order. Two effects with different dependencies may execute in any order.

**Incorrect (assuming first effect runs before second):**

```typescript
createEffect(() => {
  wasPaginatingRef.current = props.isFetchingNextPage
})

createEffect(() => {
  if (!wasPaginatingRef.current) {
    scrollToBottom()  // ❌ May run BEFORE the first effect!
  }
})
```

**Correct (single effect or shared signal):**

```typescript
// Best: single effect with all logic
createEffect(() => {
  if (props.isFetchingNextPage) return
  scrollToBottom()
})

// Alternative: shared signal state
const [isBlocked, setIsBlocked] = createSignal(false)

createEffect(() => {
  setIsBlocked(props.isFetchingNextPage)
})

createEffect(() => {
  if (isBlocked()) return
  scrollToBottom()
})
```

Reference: [SolidJS Effects](https://docs.solidjs.com/concepts/effects)

## Access Signals/Stores Directly in JSX

**Impact: CRITICAL (silent tracking loss — UI stops reacting to changes)**

Signal and store access must happen inside the reactive context (JSX, createEffect, createMemo), not inside helper functions called from JSX. The reactive system tracks where signals are read — if they're read inside a plain function, the tracking happens there, not in JSX.

**Incorrect (access happens in helper, outside reactive JSX context):**

```typescript
const [expanded, setExpanded] = createStore<boolean[]>([])

const isExpanded = (index: number) => expanded[index] === true

// In JSX — this WON'T update when expanded changes!
<Show when={isExpanded(index())}>
  <Content />
</Show>
```

**Correct (access happens directly in JSX reactive context):**

```typescript
<Show when={expanded[index()]}>
  <Content />
</Show>
```

Similarly for signals:

```typescript
// ❌ Access in helper
const getCount = () => count()
<div>{getCount()}</div>  // Won't update!

// ✅ Access directly in JSX
<div>{count()}</div>
```

Reference: [SolidJS Reactivity](https://docs.solidjs.com/concepts/intro-to-reactivity)

## Use splitProps Instead of Rest Spread

**Impact: CRITICAL (extracted props lose reactivity silently)**

Rest spread (`{ variant, ...rest }`) destructures, which captures values once. Use `splitProps` to maintain reactivity on all extracted props.

**Incorrect (rest spread loses reactivity on extracted props):**

```typescript
function Button({ variant, ...rest }: ButtonProps) {
  return (
    <button class={variant === "primary" ? "btn-primary" : "btn"} {...rest}>
      {rest.children}
    </button>
  )
}
// variant won't update if parent re-renders with new variant
```

**Correct (splitProps maintains reactivity):**

```typescript
import { splitProps } from "solid-js"

function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["variant"])
  return (
    <button class={local.variant === "primary" ? "btn-primary" : "btn"} {...rest}>
      {props.children}
    </button>
  )
}
// local.variant stays reactive
```

Reference: [SolidJS splitProps](https://docs.solidjs.com/reference/component-apis/split-props)

## Use Store Instead of Set/Map with Signal

**Impact: CRITICAL (O(n) updates instead of O(1) — all subscribers re-run)**

`Set` and `Map` inside `createSignal` don't provide per-item reactivity. Changing any item forces ALL subscribers to update because the signal's identity changes.

**Incorrect (Set with signal — all subscribers update on any change):**

```typescript
const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set())

const toggle = (id: string) => {
  setExpandedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}
// Every component reading expandedIds() re-renders when ANY id changes
```

**Correct (Store with record — only affected subscribers update):**

```typescript
const [expanded, setExpanded] = createStore<Record<string, boolean>>({})

const toggle = (id: string) => {
  setExpanded(id, prev => !prev)
}
// Only components reading expanded[specificId] update
```

Or with boolean array for index-based access:

```typescript
const [expanded, setExpanded] = createStore<boolean[]>([])

const toggle = (index: number) => {
  setExpanded(index, prev => !prev)
}
// Only components reading expanded[specificIndex] update
```

Reference: [SolidJS Stores](https://docs.solidjs.com/concepts/stores)

## Do Not Capture Signals in Closures Outside Reactive Context

**Impact: HIGH (stale values in event handlers and callbacks)**

When a signal is accessed inside an effect that creates a closure (event handler, setTimeout callback), the signal value may be captured at closure creation time rather than read at execution time. Access signals inside the callback body, not during setup.

**Incorrect (signal captured during effect setup):**

```typescript
createEffect(() => {
  const currentMultiplier = multiplier()  // Captured once when effect runs

  element.addEventListener("click", () => {
    // Uses the captured value, not the current signal value
    setCount(c => c * currentMultiplier)
  })
})
```

**Correct (signal read at execution time in JSX handler):**

```typescript
// Signal is called inside the handler — reads current value on each click
<button onClick={() => setCount(c => c * multiplier())}>
  Multiply
</button>
```

**Correct (signal read at execution time in effect handler):**

```typescript
createEffect(() => {
  const handler = () => {
    // multiplier() is called when the click happens, not when effect runs
    setCount(c => c * multiplier())
  }

  element.addEventListener("click", handler)
  onCleanup(() => element.removeEventListener("click", handler))
})
```

**Notes:**
- The key distinction: `multiplier()` inside the handler body is called on each invocation; assigning `const val = multiplier()` outside the handler captures once
- This also applies to `setTimeout`, `setInterval`, and Promise `.then()` callbacks
- If the effect must re-register the handler when the signal changes (intentional tracking), accessing the signal at setup is correct but requires `onCleanup`

Reference: [SolidJS reactivity docs](https://docs.solidjs.com/concepts/reactivity)

## Don't Capture Signals During Handler Setup

**Impact: CRITICAL (causes stale closures and silent state bugs)**

When signals are read during effect setup (not inside the returned callback), the value is captured once and becomes stale. Always read signals at execution time — inside the event handler or callback body itself.

**Incorrect (signal captured at setup time):**

```tsx
createEffect(() => {
  const currentPage = page(); // captured once when effect runs
  document.addEventListener("scroll", () => {
    console.log("Page:", currentPage); // always logs the initial value
  });
});
```

**Incorrect (signal read outside handler):**

```tsx
const [count, setCount] = createSignal(0);
const value = count(); // captured once at component setup
return <button onClick={() => alert(value)}>Show count</button>;
// Always alerts 0, even after setCount(5)
```

**Correct (read signal at execution time):**

```tsx
createEffect(() => {
  const handler = () => {
    console.log("Page:", page()); // read at scroll time — always current
  };
  document.addEventListener("scroll", handler);
  onCleanup(() => document.removeEventListener("scroll", handler));
});
```

**Correct (read signal inside handler):**

```tsx
const [count, setCount] = createSignal(0);
return <button onClick={() => alert(count())}>Show count</button>;
// Always alerts the current value
```

The key principle: signal getter calls (`signal()`) must happen at the moment you need the value, not ahead of time.

Reference: [SolidJS Docs - Reactivity](https://docs.solidjs.com/concepts/intro-to-reactivity)

## Use on() to Break Circular Dependencies

**Impact: HIGH (infinite effect loops from reading and writing the same signal)**

When an effect reads a signal it also writes, it creates a circular dependency. Use `on()` to explicitly declare which signals trigger the effect — the callback body runs in an untracked context.

**Incorrect (circular dependency — effect triggers itself):**

```typescript
createEffect(() => {
  const status = streamStatusQuery.data  // tracked
  if (!status) return
  if (status.isStreaming && !isWaitingForResponse()) {  // tracked!
    setIsWaitingForResponse(true)  // triggers re-run!
  }
})
```

**Correct (on() — only track query data, not the signal being written):**

```typescript
createEffect(on(
  () => streamStatusQuery.data,
  (status) => {
    if (!status) return
    // isWaitingForResponse() read here is UNTRACKED
    if (status.isStreaming && !isWaitingForResponse()) {
      setIsWaitingForResponse(true)
    }
  },
  { defer: true }
))
```

**Use `untrack()` for surgical opt-out** when most reads should track but one shouldn't:

```typescript
createEffect(() => {
  const value = importantSignal()  // tracked
  const context = untrack(() => otherSignal())  // NOT tracked
  process(value, context)
})
```

Reference: [SolidJS on()](https://docs.solidjs.com/reference/reactive-utilities/on)

## Use Signals for Timing-Sensitive State, Not Refs

**Impact: CRITICAL (closures capture stale ref values — race conditions and bugs)**

Plain JS variables (refs) are captured when closures are created. Signals are read at execution time. For any state that must reflect the current value inside setTimeout, Promise callbacks, or event handlers, use signals.

**Incorrect (ref value captured at scheduling time):**

```typescript
let isPaginating = false

const handleLoadMore = () => {
  isPaginating = true
  fetchNextPage()
}

createEffect(() => {
  const timeout = setTimeout(() => {
    if (!isPaginating) {  // ❌ Reads OLD value from closure
      scrollToBottom()     // Scrolls even though isPaginating was set!
    }
  }, 100)
  return () => clearTimeout(timeout)
})
```

**Correct (signal read at execution time):**

```typescript
const [isPaginating, setIsPaginating] = createSignal(false)

const handleLoadMore = () => {
  setIsPaginating(true)
  fetchNextPage()
}

createEffect(() => {
  const timeout = setTimeout(() => {
    if (!isPaginating()) {  // ✅ Reads CURRENT value
      scrollToBottom()
    }
  }, 100)
  return () => clearTimeout(timeout)
})
```

**Key insight**: Signals are *read* when called. Refs are *captured* when closures are created.

Reference: [SolidJS Signals](https://docs.solidjs.com/concepts/signals)

## Use untrack When Invoking Render Callbacks

**Impact: MEDIUM (parent computations subscribe to signals inside child render functions)**

When a parent effect or memo calls a render callback (children-as-function, render props), wrap the call in `untrack()`. Without this, the parent computation subscribes to every signal the child accesses, causing the parent to re-run when child dependencies change.

**Incorrect (parent memo tracks child signals):**

```typescript
const Wrapper = (props) => {
  const output = createMemo(() => {
    const data = fetchData()
    // BAD: if props.children accesses its own signals, this memo
    // will re-run whenever those child signals change too
    return props.children(data)
  })

  return <div>{output()}</div>
}
```

**Correct (untrack prevents parent from subscribing to child signals):**

```typescript
const Wrapper = (props) => {
  const output = createMemo(() => {
    const data = fetchData()
    // GOOD: parent memo only tracks fetchData(), not child internals
    return untrack(() => props.children(data))
  })

  return <div>{output()}</div>
}
```

**This is how Solid's built-in components work internally:**

```typescript
// Simplified <Show> implementation from solid-js source:
return createMemo(() => {
  const c = condition()
  if (c) {
    // Children are called inside untrack to prevent Show
    // from subscribing to the child's dependencies
    return untrack(() => child(c))
  }
  return fallback
})
```

**Common scenarios where this matters:**

```typescript
// Render prop components
const DataProvider = (props) => {
  const data = createResource(/* ... */)

  return createMemo(() => {
    const d = data()
    return d ? untrack(() => props.render(d)) : props.fallback
  })
}

// Custom control flow
const When = (props) => {
  return createMemo(() => {
    return props.condition()
      ? untrack(() => props.children())
      : null
  })
}
```

**Notes:**
- `untrack` prevents the current computation from subscribing to signals read inside the callback — the child's own effects still track normally
- This is critical for control-flow components and any component that calls render callbacks inside `createMemo` or `createEffect`
- If you're building a component library, audit every place you call `props.children` inside a tracked scope
- SolidJS's `<Show>`, `<Switch>`, `<For>` all use this pattern internally

Reference: [SolidJS untrack](https://docs.solidjs.com/reference/reactive-utilities/untrack)

## Use untrack() for Surgical Dependency Opt-Out

**Impact: MEDIUM (prevents unwanted effect re-runs from incidental signal reads)**

`untrack()` reads a signal's value without creating a reactive dependency. Use it when you need to read a signal inside a tracking scope (effect, memo) but don't want that read to trigger re-execution. This is distinct from `on()`, which explicitly lists what to track.

**Incorrect (incidental dependency causes extra re-runs):**

```tsx
createEffect(() => {
  // Re-runs when EITHER searchQuery or debugMode changes
  console.log(`[debug=${debugMode()}] Searching: ${searchQuery()}`);
  performSearch(searchQuery());
});
```

**Correct (untrack the incidental read):**

```tsx
import { untrack } from "solid-js";

createEffect(() => {
  // Only re-runs when searchQuery changes
  console.log(`[debug=${untrack(debugMode)}] Searching: ${searchQuery()}`);
  performSearch(searchQuery());
});
```

**Common use cases:**

```tsx
// Read initial value without tracking
const initialValue = untrack(count);

// Log without creating dependency
createEffect(() => {
  const result = computeResult(input());
  console.log("Previous count was:", untrack(count));
  setOutput(result);
});

// Conditional tracking
createEffect(() => {
  const mode = trackingMode();
  if (mode === "detailed") {
    doDetailed(details()); // tracked
  } else {
    doSimple(untrack(details)); // not tracked in simple mode
  }
});
```

**When to use `untrack()` vs `on()`:**
- `untrack()` — opt OUT of tracking specific reads within an effect
- `on()` — opt IN to tracking specific signals (ignore everything else)

Reference: [SolidJS Docs - untrack](https://docs.solidjs.com/reference/reactive-utilities/untrack)

## Use on() with Array for Multiple Explicit Dependencies

**Impact: MEDIUM (prevents unwanted effect re-runs with precise dependency control)**

Pass an array of accessors to `on()` for explicit multi-signal tracking with previous values. The callback body is untracked.

**Incorrect:**

```typescript
// ❌ Auto-tracking captures ALL reads including unrelated signals
createEffect(() => {
  const a = signalA()
  const b = signalB()
  const config = configSignal()  // Unintended dependency!
  analytics.track("change", { a, b })
})
```

**Correct:**

```typescript
// ✅ Only tracks signalA and signalB, with previous values
createEffect(on(
  [() => signalA(), () => signalB()],
  ([a, b], [prevA, prevB]) => {
    const config = configSignal()  // NOT tracked
    if (prevA !== undefined) {
      analytics.track("change", { from: [prevA, prevB], to: [a, b] })
    }
  }
))
```

Reference: [SolidJS on()](https://docs.solidjs.com/reference/reactive-utilities/on)

## Debounce Effects with on() and onCleanup

**Impact: MEDIUM (prevents excessive API calls and recomputations)**

Use `on()` for explicit tracking + `onCleanup` to cancel pending timers for a clean debounce pattern.

**Incorrect:**

```typescript
// ❌ Fires API call on every keystroke
createEffect(() => {
  const term = searchInput()
  if (term.length > 2) performSearch(term)
})
```

**Correct:**

```typescript
createEffect(on(
  () => searchInput(),
  (input) => {
    const timer = setTimeout(() => performSearch(input), 300)
    onCleanup(() => clearTimeout(timer))
  }
))
```

Reference: [SolidJS on()](https://docs.solidjs.com/reference/reactive-utilities/on)

# 2. Data Fetching & Server

**Impact: CRITICAL** — Correct data fetching patterns (createAsync, query, createResource, Solid Query) prevent waterfalls, avoid Suspense traps, and keep UIs responsive. SolidStart server functions ("use server") require input validation at the boundary.

## Use createResource for Standalone Async Data

**Impact: MEDIUM (provides built-in loading/error states and Suspense integration)**

For non-SolidStart apps (or when you don't need Solid Router's caching), `createResource` is the built-in primitive for async data. It provides reactive loading/error states, integrates with Suspense, and supports `mutate` for optimistic updates.

**Incorrect (manual async state management):**

```tsx
function UserProfile(props) {
  const [user, setUser] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  createEffect(async () => {
    setLoading(true);
    try {
      const data = await fetchUser(props.id());
      setUser(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  });
  // Async in createEffect breaks tracking, manual state is error-prone
}
```

**Correct (createResource with Suspense):**

```tsx
import { createResource, Suspense, Show } from "solid-js";

function UserProfile(props) {
  const [user, { mutate, refetch }] = createResource(
    () => props.id(),   // reactive source — refetches when id changes
    (id) => fetchUser(id) // fetcher function
  );

  return (
    <Show when={!user.error} fallback={<p>Error: {user.error.message}</p>}>
      <div>{user()?.name}</div>
    </Show>
  );
}

// Wrap with Suspense for loading states
<Suspense fallback={<Skeleton />}>
  <UserProfile id={userId} />
</Suspense>
```

**When to use which:**
- `createResource` — standalone apps, simple fetching with mutate/refetch
- `createAsync` + `query` — SolidStart/Solid Router apps with route-level caching
- Solid Query — complex caching, pagination, infinite scroll, background refetching

Reference: [SolidJS Docs - createResource](https://docs.solidjs.com/reference/basic-reactivity/create-resource)

## Guard .data Access to Prevent Unwanted Suspense

**Impact: CRITICAL (entire UI replaced by skeleton when any query loads)**

In Solid Query, queries suspend by DEFAULT inside Suspense boundaries. Accessing `query.data` while loading triggers Suspense — the nearest boundary shows its fallback, potentially replacing your entire UI.

**Incorrect (accessing .data triggers Suspense — whole app shows skeleton):**

```typescript
const showSalesPitch = createMemo(
  () => paymentError() || (user.data?.balance ?? 1_000_000_000) <= 0
)
// When user query is loading, this accesses user.data → SUSPENDS → whole app skeleton!
```

**Correct (guard .data access with .isLoading check):**

```typescript
const showSalesPitch = createMemo(
  () => paymentError() ||
    (user.isLoading ? false : (user.data?.balance ?? 1_000_000_000) <= 0)
)
// When loading, returns safe default without accessing .data → NO SUSPENSION
```

**The pattern:** Always check `.isLoading` before `.data`:

```typescript
// For boolean decisions
query.isLoading ? defaultValue : query.data?.someProperty

// For rendering
<Show when={!query.isLoading && query.data}>
  {(data) => <Component data={data()} />}
</Show>
```

**Alternative: Inner Suspense boundaries** to isolate suspension:

```typescript
<Suspense fallback={<AppSkeleton />}>
  <Layout>
    <ChatFeed />
    <Suspense fallback={<SendMessageSkeleton />}>
      <SendMessage />  {/* Query suspension isolated here */}
    </Suspense>
  </Layout>
</Suspense>
```

Reference: [SolidJS Suspense](https://docs.solidjs.com/reference/components/suspense)

## Include All Dependencies in Query Keys

**Impact: HIGH (stale data served from wrong cache entry)**

Query keys determine cache identity. Missing a dependency means different requests share the same cache, returning stale or wrong data.

**Incorrect (query key missing userId — always hits same cache):**

```typescript
function UserPosts(props: { userId: Accessor<string> }) {
  const query = createQuery(() => ({
    queryKey: ["posts"],  // Missing userId!
    queryFn: () => fetchPosts(props.userId()),
  }))
}
```

**Correct (query key includes all dependencies):**

```typescript
function UserPosts(props: { userId: Accessor<string> }) {
  const query = createQuery(() => ({
    queryKey: ["posts", props.userId()],  // Cache is per-user
    queryFn: () => fetchPosts(props.userId()),
  }))
}
```

Reference: [TanStack Query Keys](https://tanstack.com/query/latest/docs/framework/solid/guides/query-keys)

## Invalidate Queries After Mutations

**Impact: HIGH (stale UI after mutations causes user confusion)**

After a successful mutation with Solid Query, always invalidate related queries to refetch fresh data. Without invalidation, the UI shows stale cached data until the next automatic refetch.

**Incorrect (mutation without cache invalidation):**

```typescript
const mutation = createMutation(() => ({
  mutationFn: (data: UserUpdate) => updateUser(props.userId, data),
  // ❌ No onSuccess — cached user data is now stale
}))
```

**Correct (invalidate related queries on success):**

```typescript
import { createMutation, useQueryClient } from "@tanstack/solid-query"

function UpdateButton(props: { userId: string }) {
  const queryClient = useQueryClient()

  const mutation = createMutation(() => ({
    mutationFn: (data: UserUpdate) => updateUser(props.userId, data),
    onSuccess: () => {
      // ✅ Invalidate and refetch the user query
      queryClient.invalidateQueries({ queryKey: ["user", props.userId] })
    },
  }))

  return (
    <button
      onClick={() => mutation.mutate({ name: "New Name" })}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? "Saving..." : "Save"}
    </button>
  )
}
```

**Notes:**
- Use `queryClient.invalidateQueries()` with the query key to mark cached data as stale
- For optimistic updates, use `onMutate` to update the cache before the server responds
- Invalidate with partial keys to refetch related queries: `{ queryKey: ["users"] }` invalidates all user queries
- Wrap the mutation options in an arrow function (Solid Query requires it for reactivity)

## Never Destructure Solid Query Results

**Impact: CRITICAL (query state frozen — loading/error/data never update)**

Solid Query returns reactive proxies, not plain objects. Destructuring captures values once at creation time. This is the #1 migration gotcha from React Query.

**Incorrect (destructured values are static snapshots):**

```typescript
const { data, isLoading, error } = createQuery(() => ({
  queryKey: ["users"],
  queryFn: fetchUsers,
}))

// data, isLoading, error NEVER update
return <div>{isLoading ? "Loading..." : data?.length}</div>
```

**Correct (access properties on query object in JSX):**

```typescript
const query = createQuery(() => ({
  queryKey: ["users"],
  queryFn: fetchUsers,
}))

// Properties accessed in reactive context = automatic updates
return <div>{query.isLoading ? "Loading..." : query.data?.length}</div>
```

Reference: [TanStack Solid Query](https://tanstack.com/query/latest/docs/solid/overview)

## Don't Create Query Waterfalls

**Impact: CRITICAL (2-5× slower load times from sequential fetching)**

Independent queries should fetch in parallel. Don't gate one query on another unless there's a true data dependency.

**Incorrect (unnecessary waterfall — second query waits for first):**

```typescript
function Dashboard() {
  const usersQuery = createQuery(() => ({
    queryKey: ["users"],
    queryFn: fetchUsers,
  }))

  const statsQuery = createQuery(() => ({
    queryKey: ["stats"],
    queryFn: fetchStats,
    enabled: !!usersQuery.data,  // Unnecessary dependency!
  }))
}
```

**Correct (independent queries fetch in parallel):**

```typescript
function Dashboard() {
  const usersQuery = createQuery(() => ({
    queryKey: ["users"],
    queryFn: fetchUsers,
  }))

  const statsQuery = createQuery(() => ({
    queryKey: ["stats"],
    queryFn: fetchStats,
    // No enabled — fetches immediately in parallel
  }))
}
```

Only use `enabled` when there's a genuine data dependency (e.g., fetch user's posts after user ID is known).

Reference: [TanStack Query Dependent Queries](https://tanstack.com/query/latest/docs/framework/solid/guides/dependent-queries)

## Solid Query Integrates with Suspense Automatically

**Impact: MEDIUM (eliminates boilerplate loading state management)**

Unlike React Query where you opt in with `useSuspenseQuery` or `suspense: true`, Solid Query queries automatically suspend inside `<Suspense>` boundaries. Any `createQuery` call nested within a Suspense boundary will trigger the fallback while loading — no configuration needed.

**Incorrect (React Query pattern — unnecessary in Solid):**

```tsx
// Don't copy this from React Query docs
const user = createQuery(() => ({
  queryKey: ["user", id()],
  queryFn: fetchUser,
  suspense: true, // This option doesn't exist in Solid Query
}));
```

**Correct (just wrap with Suspense):**

```tsx
function UserProfile(props) {
  const user = createQuery(() => ({
    queryKey: ["user", props.id()],
    queryFn: () => fetchUser(props.id()),
  }));

  // query.data is available directly — Suspense handles the loading state
  return <div>{user.data?.name}</div>;
}

// Parent provides the Suspense boundary
<Suspense fallback={<Skeleton />}>
  <UserProfile id={userId} />
</Suspense>
```

Similarly, `notifyOnChangeProps` is unnecessary — SolidJS's fine-grained reactivity automatically tracks which query properties (`.data`, `.isLoading`, etc.) are accessed in JSX.

Reference: [TanStack Solid Query Overview](https://tanstack.com/query/latest/docs/solid/overview)

## Use enabled Option for Conditional Queries

**Impact: HIGH (prevents unnecessary network requests and runtime errors from missing dependencies)**

Solid Query's `enabled` option controls when a query should execute. Use it with signal-derived booleans to defer fetching until prerequisite data is available. Without it, queries fire immediately — even when required parameters are undefined.

**Incorrect (query fires before dependency is ready):**

```tsx
const messages = createQuery(() => ({
  queryKey: ["messages", props.conversationId()],
  queryFn: () => fetchMessages(props.conversationId()),
  // Fires immediately, even when conversationId is undefined
}));
```

**Correct (query deferred until dependency exists):**

```tsx
const messages = createQuery(() => ({
  queryKey: ["messages", props.conversationId()],
  queryFn: () => fetchMessages(props.conversationId()!),
  enabled: !!props.conversationId(),
}));
```

**Correct (multiple conditions):**

```tsx
const analytics = createQuery(() => ({
  queryKey: ["analytics", userId(), dateRange()],
  queryFn: () => fetchAnalytics(userId()!, dateRange()!),
  enabled: !!userId() && !!dateRange(),
}));
```

The `enabled` option is reactive — when the signal changes from falsy to truthy, the query automatically starts fetching. No manual `refetch()` needed.

Reference: [Solid Query - Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/solid/guides/disabling-queries)

## Wrap Query Options in Arrow Function

**Impact: HIGH (reactive query keys don't update — queries never refetch)**

In Solid Query, options must be wrapped in a function `() => ({...})` to enable reactive query keys. This is different from React Query's plain object.

**Incorrect (plain object — query keys don't react to signal changes):**

```typescript
// React Query pattern — WRONG in Solid Query
const query = createQuery({
  queryKey: ["user", userId()],
  queryFn: () => fetchUser(userId()),
})
```

**Correct (arrow function wrapper enables reactivity):**

```typescript
const query = createQuery(() => ({
  queryKey: ["user", userId()],  // userId is a signal — re-fetches when it changes
  queryFn: () => fetchUser(userId()),
}))
```

This applies to `createQuery`, `createMutation`, and `createInfiniteQuery`.

Reference: [TanStack Solid Query Overview](https://tanstack.com/query/latest/docs/solid/overview)

## Use resource.latest for Consistent Stale-While-Revalidate UI

**Impact: MEDIUM (inconsistent data display during error states and initial loads)**

`resource()` and `resource.latest` both retain the previous value during refetch (state: `"refreshing"`). The key difference is error handling: `resource()` throws on error (triggering ErrorBoundary), while `resource.latest` returns the last successful value. Use `resource.latest` when you want to keep showing data even after an error, and pair with `resource.loading` / `resource.state` for loading indicators.

**Basic pattern — loading indicator without Suspense fallback flash:**

```typescript
const [page, setPage] = createSignal(1)
const [data] = createResource(page, fetchPage)

return (
  <div>
    <Show when={data.loading}>
      <div class="overlay-spinner" />  {/* Subtle loading indicator */}
    </Show>
    <div style={{ opacity: data.loading ? 0.6 : 1 }}>
      {data.latest?.title}  {/* Shows previous page during load AND errors */}
    </div>
  </div>
)
```

**resource() vs resource.latest:**

| Accessor | Initial Load | Refetch (`"refreshing"`) | On Error |
|----------|-------------|--------------------------|----------|
| `resource()` | `undefined` | Previous value | Throws (triggers ErrorBoundary) |
| `resource.latest` | `undefined` | Previous value | Last successful value |

**When resource.latest matters most — error resilience:**

```typescript
// resource() throws on error → ErrorBoundary catches it, UI replaced
// resource.latest returns last good value → data stays visible

<ErrorBoundary fallback={<ErrorPanel />}>
  <div>{data()?.title}</div>  {/* Replaced by ErrorPanel on error */}
</ErrorBoundary>

// vs

<div>
  <Show when={data.error}>
    <div class="error-banner">{data.error.message}</div>
  </Show>
  <div>{data.latest?.title}</div>  {/* Still shows last successful data */}
</div>
```

**Combine with useTransition for route-level transitions:**

```typescript
const [isPending, start] = useTransition()
const navigate = (page: number) => start(() => setPage(page))

// isPending() is true while new data loads — dim the current content
<div style={{ opacity: isPending() ? 0.6 : 1 }}>
  <PageContent data={data} />
</div>
```

**With initialValue for type safety:**

```typescript
// Without initialValue: data() can be undefined during initial load
const [data] = createResource(source, fetcher)

// With initialValue: data() always returns T (never undefined)
const [data] = createResource(source, fetcher, { initialValue: [] })
// data.latest is also always T
```

**Notes:**
- During refetch, both `resource()` and `resource.latest` return the previous value — the difference is only on error
- `resource.latest` is most valuable for error-resilient UIs where you want data to remain visible
- Use `resource.state` for fine-grained status: `"unresolved"`, `"pending"`, `"ready"`, `"refreshing"`, `"errored"`
- Pair with `data.loading` for subtle loading indicators (opacity, overlay spinners)
- This pattern is especially valuable for pagination, search-as-you-type, and dashboard auto-refresh

Reference: [SolidJS createResource](https://docs.solidjs.com/reference/basic-reactivity/create-resource)

## Use createInfiniteQuery for Paginated Data

**Impact: HIGH (eliminates manual pagination state management)**

Use `createInfiniteQuery` for cursor-based or offset-based pagination. Flatten pages with a derived signal, and use `hasPreviousPage`/`hasNextPage` for load-more controls.

**Incorrect (manual pagination with createQuery):**

```typescript
const [page, setPage] = createSignal(0)
const [allMessages, setAllMessages] = createSignal<Message[]>([])
const query = createQuery(() => ({
  queryKey: ["messages", props.conversationId, page()],
  queryFn: () => fetchMessages(props.conversationId, page()),
}))
// ❌ Manual accumulation, race conditions, no bidirectional loading
```

**Correct (createInfiniteQuery):**

```typescript
const query = createInfiniteQuery(() => ({
  queryKey: ["messages", props.conversationId],
  queryFn: ({ pageParam }) => fetchMessages(props.conversationId, pageParam),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  getPreviousPageParam: (firstPage) => firstPage.prevCursor,
}))
const allMessages = () => query.data?.pages.flatMap((page) => page.items) ?? []
```

Reference: [TanStack Solid Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/solid/guides/infinite-queries)

## Use throwOnError with ErrorBoundary for Query Errors

**Impact: MEDIUM (declarative error handling without manual checks)**

Use `throwOnError: true` on queries to let errors bubble to the nearest `ErrorBoundary`. Pairs naturally with `Suspense`.

**Incorrect (manual error checking in every component):**

```typescript
// ❌ Every component repeats isError/isLoading/data boilerplate
return (
  <div>
    <Show when={query.isError}><ErrorMsg /></Show>
    <Show when={query.isLoading}><Spinner /></Show>
    <Show when={query.data}><Content /></Show>
  </div>
)
```

**Correct (throwOnError + ErrorBoundary):**

```typescript
const query = createQuery(() => ({
  queryKey: ["users"],
  queryFn: fetchUsers,
  throwOnError: true,
}))

// Parent:
<ErrorBoundary fallback={(err) => <UserListError error={err} />}>
  <Suspense fallback={<UserListSkeleton />}>
    <UserList />
  </Suspense>
</ErrorBoundary>
```

Reference: [TanStack Query Error Handling](https://tanstack.com/query/latest/docs/framework/solid/guides/suspense)

## Use Switch/Match for Mutually Exclusive Query States

**Impact: MEDIUM (prevents showing stale data during loading/error transitions)**

Use `Switch`/`Match` instead of multiple `Show` for query states (pending, error, success) — they're mutually exclusive.

**Incorrect:**

```typescript
// ❌ Multiple Shows can render simultaneously during transitions
<Show when={query.isLoading}><Spinner /></Show>
<Show when={query.error}><ErrorMessage /></Show>
<Show when={query.data}><UserCard /></Show>
```

**Correct:**

```typescript
<Switch>
  <Match when={query.isPending}><Skeleton /></Match>
  <Match when={query.isError}><ErrorState error={query.error} retry={query.refetch} /></Match>
  <Match when={query.isSuccess}><UserCard user={query.data!} /></Match>
</Switch>
```

Reference: [SolidJS Switch/Match](https://docs.solidjs.com/reference/components/switch-and-match)

# 3. Component Patterns

**Impact: HIGH** — Props handling (splitProps, mergeProps), children patterns, and component composition are unique in SolidJS. Destructuring breaks reactivity, rest spread loses tracking, and component functions run once (not per-render like React).

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
import { Dialog } from "@kobalte/core/dialog"
import { Select } from "@kobalte/core/select"
import { Tabs } from "@kobalte/core/tabs"

// Wrong — deprecated barrel export
import { Dialog } from "@kobalte/core"
```

**Key points:**
- Kobalte is unstyled — zero CSS shipped, bring your own styles or use shadcn-solid
- Use Kobalte for: Dialog, Select, Combobox, Tabs, Menu, Toast, Popover, Tooltip
- For simple toggles, manual `aria-expanded` + `role="region"` is fine (see component-aria-live-dynamic)

Reference: [Kobalte Documentation](https://kobalte.dev)

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

## Use children() Helper to Resolve and Memoize Children

**Impact: MEDIUM (repeated expensive child evaluation, inability to inspect/manipulate children)**

When you need to inspect, iterate, or manipulate `props.children`, use the `children()` helper from `solid-js`. It resolves reactive children (functions, fragments) into resolved child values and memoizes the result. Resolved children can be DOM nodes, text nodes, primitives, JSX elements, or null.

**Incorrect (accessing props.children directly for manipulation):**

```typescript
const Wrapper = (props) => {
  // BAD: props.children might be a function, fragment, or reactive expression
  // Accessing it multiple times re-evaluates each time
  createEffect(() => {
    console.log(props.children) // Could be a getter, not resolved values
  })

  return <div>{props.children}</div>
}
```

**Correct (children() resolves and memoizes):**

```typescript
import { children, createEffect } from "solid-js"

const ColoredList = (props) => {
  const resolved = children(() => props.children)

  // resolved() returns resolved child values — safe to inspect/modify
  createEffect(() => {
    const nodes = resolved.toArray()
    nodes.forEach((node, i) => {
      if (node instanceof HTMLElement) {
        node.style.color = i % 2 === 0 ? "red" : "blue"
      }
    })
  })

  return <div>{resolved()}</div>
}
```

**When you need children() vs when you don't:**

```typescript
// DON'T need children() — just rendering children as-is
const Card = (props) => <div class="card">{props.children}</div>

// DO need children() — inspecting or transforming children
const Tabs = (props) => {
  const tabs = children(() => props.children)

  return (
    <div>
      <div class="tab-bar">
        <For each={tabs.toArray()}>
          {(tab) => <button>{(tab as HTMLElement).dataset.label}</button>}
        </For>
      </div>
      <div class="tab-content">{tabs()}</div>
    </div>
  )
}
```

**Notes:**
- `children()` returns a memo — call it as `resolved()` to get the resolved value
- Use `.toArray()` to get a flat array of all child nodes
- Only use `children()` when you need to inspect or manipulate — for simple pass-through, `props.children` is fine
- The helper handles all child types: static elements, dynamic expressions, arrays, and fragments

Reference: [SolidJS children helper](https://docs.solidjs.com/reference/component-apis/children)

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

## Use Dynamic for Polymorphic Components

**Impact: MEDIUM (verbose conditional JSX for component-switching, duplicated prop spreading)**

When a component needs to render as different elements or components based on a prop, use `<Dynamic>` instead of conditional branches. This is the standard pattern for "render as" / polymorphic component APIs.

**Incorrect (duplicated JSX branches):**

```typescript
const Button = (props) => {
  const [local, rest] = splitProps(props, ["as", "children"])

  // BAD: duplicate prop spreading, grows with each variant
  if (local.as === "a") return <a {...rest}>{local.children}</a>
  if (local.as === "link") return <A {...rest}>{local.children}</A>
  return <button {...rest}>{local.children}</button>
}
```

**Correct (Dynamic handles component switching):**

```typescript
import { Dynamic } from "solid-js/web"

const Button = (props) => {
  const [local, rest] = splitProps(props, ["as", "children", "class"])

  return (
    <Dynamic
      component={local.as ?? "button"}
      class={`btn ${local.class ?? ""}`}
      {...rest}
    >
      {local.children}
    </Dynamic>
  )
}

// Usage:
<Button>Click me</Button>              // renders <button>
<Button as="a" href="/about">Link</Button>  // renders <a>
<Button as={Link} to="/home">Route</Button> // renders <Link> component
```

**Common use cases:**

```typescript
// Heading level component
const Heading = (props) => {
  const [local, rest] = splitProps(props, ["level", "children"])
  return (
    <Dynamic component={`h${local.level ?? 1}`} {...rest}>
      {local.children}
    </Dynamic>
  )
}

// Icon component selecting by name
const Icon = (props) => {
  const icons = { home: HomeIcon, settings: SettingsIcon, user: UserIcon }
  return <Dynamic component={icons[props.name]} {...props} />
}
```

**Notes:**
- `component` accepts strings (`"div"`, `"a"`) or components (`MyComponent`)
- When `component` is reactive, `Dynamic` handles unmounting/remounting automatically
- Combine with `splitProps` to separate the `as`/`component` prop from pass-through props
- This is how component libraries (Hope UI, Kobalte) implement their polymorphic APIs

Reference: [SolidJS Dynamic](https://docs.solidjs.com/reference/components/dynamic)

## Use mergeProps for Default Values

**Impact: HIGH (broken reactivity on defaulted props)**

When a component needs default values for optional props, use `mergeProps` instead of destructuring with defaults (`{ size = "md" }`). JavaScript destructuring defaults are evaluated once at component creation and lose reactivity.

**Incorrect (destructuring defaults lose reactivity):**

```typescript
// size defaults to "md" but won't update if parent changes the prop later
function Button({ size = "md", children }) {
  return <button class={`btn-${size}`}>{children}</button>
}
```

**Correct (mergeProps preserves reactivity):**

```typescript
import { mergeProps } from "solid-js"

function Button(props: { size?: "sm" | "md" | "lg" }) {
  const merged = mergeProps({ size: "md" as const }, props)

  // merged.size is reactive — updates when props.size changes
  return <button class={`btn-${merged.size}`}>{props.children}</button>
}
```

**Notes:**
- `mergeProps` creates a reactive proxy; later sources override earlier ones
- Combine with `splitProps` when you also need to forward remaining props
- For components with many defaults, `mergeProps` keeps the component body clean

Reference: [SolidJS mergeProps docs](https://docs.solidjs.com/reference/component-apis/merge-props)

## Don't Return Early Before Reactive Primitives

**Impact: HIGH (hooks run inconsistently — effects and signals may not initialize)**

SolidJS components run once. Early returns before `createSignal`/`createEffect` mean those primitives never execute. Unlike React, there's no "rules of hooks" error — it silently fails.

**Incorrect (early return before hooks):**

```typescript
function UserProfile(props) {
  if (!props.userId) {
    return <div>No user</div>
  }
  // These might never run
  const [data, setData] = createSignal(null)
  createEffect(() => { /* ... */ })
  return <div>{data()}</div>
}
```

**Correct (hooks always run, Show handles conditional rendering):**

```typescript
function UserProfile(props) {
  const [data, setData] = createSignal(null)

  createEffect(() => {
    if (props.userId) {
      fetchUser(props.userId).then(setData)
    }
  })

  return (
    <Show when={props.userId} fallback={<div>No user</div>}>
      <div>{data()}</div>
    </Show>
  )
}
```

Reference: [SolidJS Components](https://docs.solidjs.com/concepts/components/basics)

## Use onMount for One-Time DOM Setup

**Impact: MEDIUM (ensures DOM is available before measurements or focus)**

`onMount` runs once after the component's DOM is inserted. Use it for initial focus, DOM measurements, third-party library initialization, or any setup that requires real DOM elements. Unlike `createEffect`, it does not track dependencies and never re-runs.

**Incorrect (using createEffect for one-time setup):**

```tsx
function SearchInput() {
  let inputRef!: HTMLInputElement;

  createEffect(() => {
    inputRef.focus(); // Runs on every reactive change, not just mount
  });

  return <input ref={inputRef} />;
}
```

**Correct (onMount for one-time DOM work):**

```tsx
import { onMount } from "solid-js";

function SearchInput() {
  let inputRef!: HTMLInputElement;

  onMount(() => {
    inputRef.focus(); // Runs once after DOM insertion
  });

  return <input ref={inputRef} />;
}
```

**Correct (DOM measurements on mount):**

```tsx
function ResponsiveChart(props) {
  let containerRef!: HTMLDivElement;

  onMount(() => {
    const { width, height } = containerRef.getBoundingClientRect();
    initChart(containerRef, { width, height, data: props.data });
  });

  return <div ref={containerRef} class="chart-container" />;
}
```

Do not use `onMount` for reactive work — it won't re-run when signals change. For reactive side effects, use `createEffect`.

Reference: [SolidJS Docs - onMount](https://docs.solidjs.com/reference/lifecycle/on-mount)

## Use splitProps for Prop Forwarding

**Impact: HIGH (broken reactivity on extracted props)**

When a component needs to separate its own props from native HTML props for forwarding, use `splitProps` instead of destructuring. Destructuring captures prop values once at component creation, so updates to the parent are silently lost.

**Incorrect (destructuring loses reactivity):**

```typescript
interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary"
  loading?: boolean
}

// variant and loading are read once — future updates ignored
function Button({ variant, loading, ...rest }: ButtonProps) {
  return (
    <button
      class={variant === "primary" ? "btn-primary" : "btn"}
      disabled={loading}
      {...rest}
    />
  )
}
```

**Correct (splitProps maintains reactivity):**

```typescript
import { splitProps, type JSX } from "solid-js"

function Button(props: ButtonProps) {
  const [local, buttonProps] = splitProps(props, ["variant", "loading"])

  return (
    <button
      {...buttonProps}
      class={local.variant === "primary" ? "btn-primary" : "btn"}
      disabled={local.loading || buttonProps.disabled}
    >
      {local.loading ? <Spinner /> : props.children}
    </button>
  )
}
```

**Notes:**
- `splitProps` returns proxied objects that preserve reactivity for all keys
- The first argument lists keys to extract into `local`; everything else goes into the rest group
- You can split into more than two groups: `splitProps(props, ["a"], ["b"])` returns three objects

Reference: [SolidJS splitProps docs](https://docs.solidjs.com/reference/component-apis/split-props)

## Use Specific Component Type Annotations

**Impact: MEDIUM (unclear children expectations, weaker type checking)**

SolidJS provides four component type aliases with different `children` constraints. Use the most specific type so consumers know exactly what children are accepted.

**The type hierarchy:**

```typescript
import type { Component, VoidComponent, ParentComponent, FlowComponent } from "solid-js"

// Generic — no children constraint
const Widget: Component<{ label: string }> = (props) => ...

// No children allowed
const Icon: VoidComponent<{ name: string }> = (props) => ...

// Optional JSX.Element children
const Card: ParentComponent<{ title: string }> = (props) => ...

// Required children (often render callbacks)
const Tooltip: FlowComponent<{ text: string }, JSX.Element> = (props) => ...
```

**When to use each:**

| Type | Children | Use For |
|------|----------|---------|
| `VoidComponent<P>` | None | Leaf components: icons, inputs, badges |
| `ParentComponent<P>` | Optional `JSX.Element` | Wrappers: cards, layouts, panels |
| `FlowComponent<P, C>` | Required `C` (default `JSX.Element`) | Control flow: modals, render-prop components |
| `Component<P>` | Unconstrained | When none of the above fit |

**Example — VoidComponent prevents accidental children:**

```typescript
// TypeScript error if someone tries to pass children
const Avatar: VoidComponent<{ src: string; alt: string }> = (props) => (
  <img src={props.src} alt={props.alt} class="avatar" />
)

// TS Error: Property 'children' does not exist
<Avatar src="pic.jpg" alt="User">Some text</Avatar>
```

**Example — FlowComponent for render props:**

```typescript
const Repeat: FlowComponent<{ times: number }, (i: number) => JSX.Element> = (props) => (
  <For each={Array.from({ length: props.times }, (_, i) => i)}>
    {(i) => props.children(i)}
  </For>
)
```

**Notes:**
- Default to `VoidComponent` for leaf components — it catches accidental children at compile time
- `ParentComponent` adds `children?: JSX.Element` to props automatically
- These types are purely for TypeScript — they compile away with zero runtime cost

Reference: [SolidJS Component types](https://docs.solidjs.com/reference/component-apis/component)

# 4. State Management

**Impact: HIGH** — Choosing the right primitive (signal vs store vs context) determines update granularity. Stores provide per-property reactivity for objects/arrays. Incorrect choices cause either over-updating (signal for collections) or unnecessary complexity (store for primitives).

## Use Typed Context with Store for Global State

**Impact: MEDIUM (type-safe global state with fine-grained reactivity)**

Combine `createContext`, `createStore`, and a typed hook for app-wide state. Use getters on the context value to maintain reactivity through the provider boundary.

**Correct pattern:**

```typescript
import { createContext, useContext, ParentComponent } from "solid-js"
import { createStore } from "solid-js/store"

type ThemeStore = {
  theme: "light" | "dark"
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeStore>()

export const ThemeProvider: ParentComponent = (props) => {
  const [state, setState] = createStore({ theme: "light" as const })

  const store: ThemeStore = {
    get theme() { return state.theme },  // Getter maintains reactivity
    toggleTheme: () => setState("theme", t => t === "light" ? "dark" : "light")
  }

  return (
    <ThemeContext.Provider value={store}>
      {props.children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
```

**Key**: Use `get theme()` (getter), not `theme: state.theme` (captured once).

Reference: [SolidJS Context](https://docs.solidjs.com/concepts/context)

## Use Context with Store for App-Wide State

**Impact: HIGH (prevents prop drilling while maintaining fine-grained reactivity)**

For shared state (auth, theme, app config), combine `createContext` with `createStore`. Expose named actions instead of raw setters to keep state changes predictable and type-safe.

**Incorrect (passing raw setter through context):**

```tsx
const AppContext = createContext();

function AppProvider(props) {
  const [state, setState] = createStore({ user: null, theme: "dark" });
  return (
    <AppContext.Provider value={{ state, setState }}>
      {props.children}
    </AppContext.Provider>
  );
  // Consumers can setState("anything", "they want") — no guardrails
}
```

**Correct (expose named actions):**

```tsx
import { createContext, useContext, ParentProps } from "solid-js";
import { createStore } from "solid-js/store";

interface AppState {
  user: { name: string; email: string } | null;
  theme: "dark" | "light";
}

interface AppContextValue {
  state: AppState;
  login: (user: AppState["user"]) => void;
  logout: () => void;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextValue>();

export function AppProvider(props: ParentProps) {
  const [state, setState] = createStore<AppState>({
    user: null,
    theme: "dark",
  });

  const value: AppContextValue = {
    state,
    login: (user) => setState("user", user),
    logout: () => setState("user", null),
    toggleTheme: () =>
      setState("theme", (t) => (t === "dark" ? "light" : "dark")),
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
```

**Usage:**

```tsx
function Header() {
  const { state, toggleTheme } = useApp();
  return (
    <header>
      <span>{state.user?.name}</span>
      <button onClick={toggleTheme}>Theme: {state.theme}</button>
    </header>
  );
  // Only re-renders the specific text nodes that read state.user.name and state.theme
}
```

Stores in context give you per-property reactivity — reading `state.theme` doesn't track `state.user`, so unrelated updates don't touch unrelated DOM.

Reference: [SolidJS Docs - Context](https://docs.solidjs.com/reference/component-apis/create-context)

## Use boolean array store for expandable/collapsible lists

**Impact: HIGH — O(n) rerenders → O(1) per toggle**

When each item in a list can be independently expanded or collapsed, use `createStore<boolean[]>` instead of a signal holding a Set or array. The store proxy tracks each index separately, so toggling one item only rerenders that item.

**Incorrect (signal holding a Set — every toggle rerenders all items):**

```typescript
import { createSignal } from "solid-js"

function CollapsibleList(props: { items: Item[] }) {
  // ❌ Every toggle creates a new Set, causing all items to recheck
  const [expanded, setExpanded] = createSignal(new Set<number>())

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  return (
    <For each={props.items}>
      {(item, index) => (
        <div>
          <button onClick={() => toggle(index())}>
            {expanded().has(index()) ? "Collapse" : "Expand"}
          </button>
          <Show when={expanded().has(index())}>
            <div>{item.content}</div>
          </Show>
        </div>
      )}
    </For>
  )
}
```

**Correct (store array — only the toggled index rerenders):**

```typescript
import { createStore } from "solid-js/store"

function CollapsibleList(props: { items: Item[] }) {
  // ✅ Store tracks each index independently
  const [expanded, setExpanded] = createStore<boolean[]>([])

  const toggle = (index: number) => {
    setExpanded(index, (prev) => !prev)
  }

  return (
    <For each={props.items}>
      {(item, index) => (
        <div>
          <button onClick={() => toggle(index())}>
            {expanded[index()] ? "Collapse" : "Expand"}
          </button>
          <Show when={expanded[index()]}>
            <div>{item.content}</div>
          </Show>
        </div>
      )}
    </For>
  )
}
```

`setExpanded(2, true)` only triggers updates for components reading `expanded[2]`. With 1000 items, toggling one item updates 1 component instead of 1000.

Reference: [SolidJS Store Documentation](https://docs.solidjs.com/concepts/stores)

## Use createStore for Multi-Field Form State

**Impact: MEDIUM (over-rendering on every field change)**

For forms with multiple fields, use `createStore` instead of individual signals or a single signal holding an object. A store provides per-property reactivity: typing in the name field only re-renders the name input, not the entire form.

**Incorrect (single signal replaces entire object on every keystroke):**

```typescript
const [form, setForm] = createSignal({ name: "", email: "", message: "" })

// Every field re-renders on ANY field change because the whole object is replaced
<input
  value={form().name}
  onInput={(e) => setForm(prev => ({ ...prev, name: e.currentTarget.value }))}
/>
<input
  value={form().email}
  onInput={(e) => setForm(prev => ({ ...prev, email: e.currentTarget.value }))}
/>
```

**Correct (createStore tracks each field independently):**

```typescript
import { createStore } from "solid-js/store"

const [form, setForm] = createStore({
  name: "",
  email: "",
  message: ""
})

// Only the name input re-renders when name changes
<input
  value={form.name}
  onInput={(e) => setForm("name", e.currentTarget.value)}
/>
<input
  value={form.email}
  onInput={(e) => setForm("email", e.currentTarget.value)}
/>
<textarea
  value={form.message}
  onInput={(e) => setForm("message", e.currentTarget.value)}
/>
```

**Notes:**
- Store property access (`form.name`) creates a subscription to only that property
- The path-based setter (`setForm("name", value)`) updates a single field without replacing the object
- For nested form data (e.g., `address.city`), use nested paths: `setForm("address", "city", value)`
- For simple forms with 1-2 fields, individual `createSignal` calls are fine

Reference: [SolidJS createStore docs](https://docs.solidjs.com/reference/store-utilities/create-store)

## Use produce() for Complex Store Mutations

**Impact: HIGH (prevents missed reactivity on multi-field updates)**

When updating multiple fields or performing complex mutations on a store, use `produce` from `solid-js/store`. It provides an Immer-like API where you mutate a draft directly, and SolidJS translates mutations into granular reactive updates.

**Incorrect (multiple setter calls or manual spreading):**

```typescript
const [state, setState] = createStore({ items: [], count: 0, lastUpdated: "" })

// ❌ Multiple setter calls — each triggers separate updates
setState("items", items => [...items, newItem])
setState("count", c => c + 1)
setState("lastUpdated", new Date().toISOString())
```

**Correct (single produce call batches all mutations):**

```typescript
import { produce } from "solid-js/store"

const [state, setState] = createStore({ items: [], count: 0, lastUpdated: "" })

// ✅ All mutations in one batch — granular reactivity still works
setState(produce(draft => {
  draft.items.push(newItem)
  draft.count++
  draft.lastUpdated = new Date().toISOString()
}))
```

**Notes:**
- `produce` batches mutations into a single update pass
- Each property mutation still triggers only the subscribers of that property
- Especially useful for array operations (push, splice, sort) that are awkward with path-based setters
- Import from `solid-js/store`, not `solid-js`

## Use reconcile for Fine-Grained Async Updates

**Impact: MEDIUM-HIGH (entire list re-renders instead of minimal diff on refetch)**

When you refetch data from the server, replacing a store entirely triggers all subscribers. Use `reconcile` to diff the new data against the existing store — only changed properties trigger updates.

**Incorrect (full replacement — all subscribers update):**

```typescript
const [items, setItems] = createStore<Item[]>([])

createEffect(async () => {
  const data = await fetchItems()
  setItems(data)  // Every subscriber re-runs even if most items unchanged
})
```

**Correct (reconcile — only changed items trigger updates):**

```typescript
import { createStore, reconcile } from "solid-js/store"

const [items, setItems] = createStore<Item[]>([])

createEffect(async () => {
  const data = await fetchItems()
  setItems(reconcile(data))  // Only 'koala' (the new item) triggers an update
})
```

**Advanced: Combine createAsync with store for reactive fine-grained data:**

```typescript
const [briefsStore, setBriefs] = createStore(initialValue)
const briefs = createAsync(async () => {
  const next = await getBriefs(searchParams.search)
  setBriefs(reconcile(next))
  return briefsStore  // Return the fine-grained store, not the raw data
}, { initialValue })
```

Reference: [SolidJS reconcile](https://docs.solidjs.com/reference/store-utilities/reconcile)

## Choose signal vs store for selection state based on cardinality

**Impact: HIGH — wrong primitive causes O(n) rerenders in large lists**

Single-selection needs a signal holding the selected ID. Multi-selection needs a store with per-key tracking. Using the wrong one either wastes rerenders or adds unnecessary complexity.

**Incorrect (signal holding a Set for multi-selection):**

```typescript
import { createSignal } from "solid-js"

function MultiSelectList(props: { items: Item[] }) {
  // ❌ New Set on every toggle — all items rerender
  const [selected, setSelected] = createSignal(new Set<string>())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <For each={props.items}>
      {(item) => (
        <div
          classList={{ selected: selected().has(item.id) }}
          onClick={() => toggle(item.id)}
        >
          {item.name}
        </div>
      )}
    </For>
  )
}
```

**Correct (signal for single-selection, store for multi-selection):**

```typescript
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"

// ✅ Single-selection: signal is perfect (one value changes)
function SingleSelectList(props: { items: Item[] }) {
  const [selectedId, setSelectedId] = createSignal<string | null>(null)

  return (
    <For each={props.items}>
      {(item) => (
        <div
          classList={{ selected: selectedId() === item.id }}
          onClick={() => setSelectedId(item.id)}
        >
          {item.name}
        </div>
      )}
    </For>
  )
}

// ✅ Multi-selection: store tracks each key independently
function MultiSelectList(props: { items: Item[] }) {
  const [selected, setSelected] = createStore<Record<string, boolean>>({})

  const toggle = (id: string) => {
    setSelected(id, (prev) => !prev)
  }

  return (
    <For each={props.items}>
      {(item) => (
        <div
          classList={{ selected: selected[item.id] }}
          onClick={() => toggle(item.id)}
        >
          {item.name}
        </div>
      )}
    </For>
  )
}
```

For single-selection with large lists, also consider `createSelector` (see `perf-create-selector` rule) for O(1) updates instead of O(n).

Reference: [SolidJS Store Documentation](https://docs.solidjs.com/concepts/stores)

## Choose Signal vs Store Based on Update Granularity

**Impact: HIGH (over-updating or unnecessary complexity)**

Signals replace the entire value on update — all subscribers re-run. Stores provide per-property reactivity. Match the primitive to your update pattern.

**Incorrect (signal for a collection with per-item updates):**

```typescript
import { createSignal } from "solid-js"

// ❌ Every item update replaces the whole array — all list items rerender
const [todos, setTodos] = createSignal<Todo[]>([])

const toggleDone = (index: number) => {
  setTodos(prev => prev.map((t, i) =>
    i === index ? { ...t, done: !t.done } : t
  ))
  // Creates a new array → every <For> item callback re-evaluates
}
```

**Correct (store for per-item updates, signal for simple values):**

```typescript
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"

// ✅ Signal for primitives and fully-replaced objects
const [isOpen, setIsOpen] = createSignal(false)
const [position, setPosition] = createSignal({ x: 0, y: 0 })

// ✅ Store for collections with per-item updates
const [todos, setTodos] = createStore<Todo[]>([])

const toggleDone = (index: number) => {
  setTodos(index, "done", prev => !prev)
  // Only the component reading todos[index].done rerenders
}

// ✅ Store for complex nested state with partial updates
const [state, setState] = createStore({
  users: [],
  settings: { theme: "dark", lang: "en" }
})
setState("settings", "theme", "light")  // Only theme subscribers update
```

**Quick reference:**

| Use Case | Primitive | Why |
|----------|-----------|-----|
| Single value | `createSignal` | Simple, low overhead |
| Object replaced entirely | `createSignal` | No partial updates needed |
| List with per-item changes | `createStore` | Fine-grained per-index reactivity |
| Complex nested state | `createStore` | Path-based partial updates |
| Selection tracking (multi) | `createStore<Record<string, boolean>>` | O(1) per-key updates |
| Selection tracking (single) | `createSignal` + `createSelector` | O(1) with only 2 items updating |

Reference: [SolidJS Stores](https://docs.solidjs.com/concepts/stores)

## Use Computed Getters in Stores for Derived Reactive Properties

**Impact: MEDIUM (stale derived values or unnecessary effects to keep store properties in sync)**

When a store property should be derived from other state (props, signals, or other store fields), define it as a getter in the initial `createStore` object. Getters are re-evaluated on each access, maintaining reactivity through the store proxy.

**Incorrect (captured once — goes stale):**

```typescript
const [state, setState] = createStore({
  firstName: "John",
  lastName: "Doe",
  fullName: "John Doe",  // BAD: static string, never updates
})
```

**Incorrect (effect to sync — overly complex):**

```typescript
const [state, setState] = createStore({ firstName: "John", lastName: "Doe", fullName: "" })

// BAD: unnecessary effect, extra update cycle
createEffect(() => {
  setState("fullName", `${state.firstName} ${state.lastName}`)
})
```

**Correct (getter — always current, zero overhead):**

```typescript
const [state, setState] = createStore({
  firstName: "John",
  lastName: "Doe",
  get fullName() { return `${this.firstName} ${this.lastName}` },
})

// state.fullName is always "John Doe" — updates when firstName or lastName change
setState("firstName", "Jane")  // state.fullName is now "Jane Doe"
```

**Pattern: Bridge props into store with getters (from Hope UI, CodeImage):**

```typescript
const [state, setState] = createStore({
  headerMounted: false,
  bodyMounted: false,
  // Reactive bridge from props — always reflects current prop value
  get opened() { return props.opened },
  get size() { return props.size ?? "md" },
  get dialogId() { return props.id ?? defaultId },
  get headerId() { return `${this.dialogId}--header` },
})
```

**Pattern: Controlled/uncontrolled component with getter:**

```typescript
const [state, setState] = createStore({
  _internalValue: props.defaultValue ?? "",
  get isControlled() { return props.value !== undefined },
  get value() { return this.isControlled ? props.value : this._internalValue },
})
```

**Notes:**
- Getters in stores use `this` to reference sibling properties — they compose naturally
- Getters are NOT cached like `createMemo` — if the computation is expensive, combine with `createMemo` outside the store
- This pattern replaces the common anti-pattern of syncing store state with effects
- Classes (`Date`, `Map`, `Set`) are not wrapped by store proxies — getters returning these won't have granular reactivity on their internal properties

Reference: [SolidJS Stores](https://docs.solidjs.com/concepts/stores)

# 5. Rendering & Control Flow

**Impact: MEDIUM-HIGH** — SolidJS control flow components (Show, For, Switch, Index, ErrorBoundary) are not syntactic sugar — they're performance-critical. Using JSX conditionals or .map() instead causes full remounts and lost state.

## ErrorBoundary Only Catches Rendering and Reactive Errors

**Impact: MEDIUM (event handler errors silently escape — users see no fallback UI)**

`<ErrorBoundary>` catches errors thrown during rendering and inside reactive computations (effects, memos). It does NOT catch errors from event handlers, `setTimeout`, `requestAnimationFrame`, or promise rejections — those bypass the boundary entirely.

**Incorrect (assuming ErrorBoundary catches everything):**

```tsx
<ErrorBoundary fallback={(err) => <p>Error: {err.message}</p>}>
  <button onClick={() => {
    // ❌ This error escapes the boundary — no fallback shown
    throw new Error("Button handler failed");
  }}>
    Click me
  </button>
</ErrorBoundary>
```

**Correct (manually catch event handler errors):**

```tsx
function SafeButton() {
  const [error, setError] = createSignal<Error | null>(null);

  return (
    <Show when={!error()} fallback={<p>Error: {error()!.message}</p>}>
      <button onClick={() => {
        try {
          riskyOperation();
        } catch (err) {
          setError(err as Error);
        }
      }}>
        Click me
      </button>
    </Show>
  );
}
```

**What ErrorBoundary DOES catch:**

```tsx
<ErrorBoundary fallback={(err) => <p>{err.message}</p>}>
  {/* ✅ Rendering errors */}
  <ComponentThatThrowsDuringRender />

  {/* ✅ Errors in effects/memos */}
  <ComponentWithFailingEffect />

  {/* ✅ Errors from createResource/createAsync (network failures) */}
  <Suspense fallback={<Loading />}>
    <AsyncComponent />
  </Suspense>
</ErrorBoundary>
```

**Tip:** For comprehensive error handling, combine `<ErrorBoundary>` for rendering errors with try/catch in event handlers and `.catch()` on promises.

Reference: [SolidJS Docs - ErrorBoundary](https://docs.solidjs.com/reference/components/error-boundary)

## Wrap Risky Components in ErrorBoundary

**Impact: HIGH (unhandled errors crash entire component tree)**

An uncaught error in any component propagates up and can tear down the entire app. Use `<ErrorBoundary>` to isolate failures and provide recovery UI. Place boundaries around data-dependent sections, third-party components, and user-generated content renderers.

**Incorrect (no error boundary — one component crash kills the app):**

```typescript
function App() {
  return (
    <div>
      <Header />
      <UserGeneratedContent />  {/* If this throws, the whole app dies */}
      <Footer />
    </div>
  )
}
```

**Correct (ErrorBoundary isolates the failure):**

```typescript
import { ErrorBoundary } from "solid-js"

function App() {
  return (
    <div>
      <Header />
      <ErrorBoundary fallback={(err, reset) => (
        <div class="error-panel">
          <p>Something went wrong: {err.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}>
        <UserGeneratedContent />
      </ErrorBoundary>
      <Footer />
    </div>
  )
}
```

**Notes:**
- The `fallback` receives the error object and a `reset` function that re-mounts the children
- Place boundaries strategically: around route content, modals, and any component that parses external data
- ErrorBoundary does not catch errors in event handlers or async code — only in the render/reactive tree
- Nest boundaries for granularity: an outer boundary for the page, inner boundaries for widgets

Reference: [SolidJS ErrorBoundary docs](https://docs.solidjs.com/reference/components/error-boundary)

## Choose Between For and Index Based on What Changes

**Impact: MEDIUM (unnecessary re-renders in dynamic lists)**

SolidJS provides two list rendering strategies. `<For>` (backed by `mapArray`) keys items by reference — efficient when items are added/removed but order is mostly stable. `<Index>` (backed by `indexArray`) keys items by index — efficient when item values change but the array length stays the same. Choosing the wrong one causes unnecessary DOM updates.

**Incorrect (For used for a fixed-length array with changing values):**

```typescript
// Bad: items change in place (e.g., live scores updating) but array length is fixed
// <For> sees every item as "removed + re-added" because references change
<For each={liveScores()}>
  {(score) => <ScoreCard value={score} />}  {/* All cards remount on every update */}
</For>
```

**Correct (Index for fixed-length arrays with changing values):**

```typescript
import { Index } from "solid-js"

// Items keyed by position — only changed values re-render
<Index each={liveScores()}>
  {(score, index) => <ScoreCard value={score()} position={index} />}
</Index>
```

**Correct (For for dynamic-length arrays with stable items):**

```typescript
import { For } from "solid-js"

// Items keyed by reference — additions/removals are efficient
<For each={chatMessages()}>
  {(message) => <ChatMessage data={message} />}
</For>
```

**Notes:**
- `<For>`: item is a plain value, index is a signal. Use when items are objects with identity (chat messages, users, todos)
- `<Index>`: item is a signal, index is a plain number. Use when items are primitives that update in place (scores, sensor readings, pixel grids)
- Rule of thumb: if you would use a `key` prop in React, use `<For>`; if items are positional, use `<Index>`
- For most UI lists (todos, users, messages), `<For>` is the right default

Reference: [SolidJS Index docs](https://docs.solidjs.com/reference/components/index-component)

## Choose mapArray vs indexArray based on what changes

**Impact: MEDIUM — wrong utility causes unnecessary remapping on updates**

SolidJS provides two low-level array mapping utilities beneath `<For>` and `<Index>`. Choose based on whether items or indices change more often.

**Incorrect (using mapArray when item values change frequently):**

```typescript
import { mapArray, createSignal } from "solid-js"

// ❌ mapArray keys by reference — when item values change, it recreates mappings
const [prices, setPrices] = createSignal([10, 20, 30])

const formatted = mapArray(prices, (price, index) => {
  // This mapping function re-runs when items change by reference
  return `$${price.toFixed(2)}`
})

// Updating a value at index 1 replaces the reference → full remap
setPrices([10, 25, 30])
```

**Correct (indexArray for value changes, mapArray for structural changes):**

```typescript
import { mapArray, indexArray, createSignal } from "solid-js"

// ✅ indexArray: items change, indices are stable (e.g., live price updates)
const [prices, setPrices] = createSignal([10, 20, 30])

const formatted = indexArray(prices, (price, index) => {
  // price is a SIGNAL — reads the current value at this index
  return <span>${price().toFixed(2)}</span>
})

// ✅ mapArray: items are stable objects, indices change (e.g., add/remove/reorder)
const [users, setUsers] = createSignal<User[]>([])

const userCards = mapArray(users, (user, index) => {
  // user is a PLAIN VALUE — stable reference, index is a signal
  return <UserCard user={user} position={index()} />
})
```

**Rule of thumb:**
- `mapArray` (what `<For>` uses): Items are stable references, indices may change → use for object lists
- `indexArray` (what `<Index>` uses): Indices are stable, item values change → use for primitive lists

Most code should use `<For>` and `<Index>` components directly. Use the raw utilities only when you need reactive array mapping outside JSX.

Reference: [SolidJS API — mapArray](https://docs.solidjs.com/reference/reactive-utilities/map-array)

## Use stable unique IDs instead of array indices for list keys

**Impact: MEDIUM-HIGH — incorrect DOM updates when lists are filtered or reordered**

When rendering lists that can be reordered, filtered, or have items removed, using array indices as keys causes DOM nodes to be associated with the wrong data. Use stable unique identifiers from your data instead.

**Incorrect (array index as key — breaks on reorder/filter):**

```typescript
<For each={filteredItems()}>
  {(item, index) => (
    // ❌ Index shifts when items are filtered/reordered
    // Item at index 2 gets the DOM state of whatever was at index 2 before
    <TodoItem key={index()} data={item} />
  )}
</For>
```

**Correct (stable unique ID as key):**

```typescript
<For each={filteredItems()}>
  {(item) => (
    // ✅ Stable ID follows the item through reorders and filters
    <TodoItem key={item.id} data={item} />
  )}
</For>
```

Note: SolidJS's `<For>` tracks items by reference by default, which handles most cases correctly without explicit keys. However, when items are recreated (e.g., from a server response where references change), explicit stable keys prevent DOM state mismatches.

For lists of primitives (numbers, strings) where values change but positions are stable, use `<Index>` instead of `<For>`:

```typescript
// ✅ <Index> for primitive lists with stable positions
<Index each={scores()}>
  {(score, index) => <span>#{index + 1}: {score()}</span>}
</Index>
```

Reference: [SolidJS — For Component](https://docs.solidjs.com/reference/components/for)

## Place Suspense Inside Conditionals (LazyShow Pattern)

**Impact: MEDIUM-HIGH (layout flicker when toggling modals/conditional content)**

Wrapping `<Show>` inside `<Suspense>` causes the Suspense fallback to flash every time the condition changes. Placing Suspense inside the Show (LazyShow pattern) avoids this.

**Incorrect (Suspense around Show — flicker on toggle):**

```typescript
<Suspense fallback={<Loading />}>
  <Show when={isModalOpen()}>
    <HeavyModal />
  </Show>
</Suspense>
```

**Correct (LazyShow pattern — Suspense inside Show):**

```typescript
function LazyShow<T>(props: {
  when: T | undefined | null | false
  fallback?: JSX.Element
  children: (value: NonNullable<T>) => JSX.Element
}) {
  return (
    <Show when={props.when}>
      {(value) => (
        <Suspense fallback={props.fallback}>
          {props.children(value())}
        </Suspense>
      )}
    </Show>
  )
}

// Usage
<LazyShow when={isModalOpen()}>
  {() => <HeavyModal />}
</LazyShow>
```

Reference: [SolidJS Suspense](https://docs.solidjs.com/reference/components/suspense)

## Use `<For>` Instead of .map() for Lists

**Impact: CRITICAL (100-1000× more DOM operations — full remount on every update)**

`.map()` works but recreates every DOM node when the list changes. `<For>` diffs by reference and only mounts new items. For lists that grow incrementally (chat, feeds), `.map()` causes catastrophic remounts.

**Incorrect (.map() — ALL items remount on every change):**

```typescript
{messages().map(message => (
  <ChatMessage key={message.id} data={message} />
)).reverse()}
// Symptoms: avatar images flash/reload, scroll position jumps,
// thousands of mounts for what should be incremental updates
```

**Correct (<For> — only new items mount):**

```typescript
const reversedMessages = createMemo(() => [...messages()].reverse())

<For each={reversedMessages()}>
  {(message) => (
    <ChatMessage data={message} />
  )}
</For>
```

**Real-world impact**: For a chat with pagination, `.map()` caused 6,000+ remounts instead of 10. Users saw avatars refreshing and scroll jumping.

Reference: [SolidJS `<For>` Component](https://docs.solidjs.com/reference/components/for)

## Use `<Show>` Instead of JSX Conditionals

**Impact: HIGH (component state lost, animations restart on condition toggle)**

JSX ternary (`? :`) and AND (`&&`) patterns destroy and recreate components on every condition change. `<Show>` preserves component instances and integrates with SolidJS signals for optimal updates.

**Incorrect (JSX conditionals — component destroyed and recreated):**

```typescript
{isLoading() && <Spinner />}

{isLoggedIn() ? <Dashboard /> : <LoginForm />}
// Component state lost, animations restart, expensive effects re-run
```

**Correct (<Show> — component instances preserved):**

```typescript
<Show when={isLoading()}>
  <Spinner />
</Show>

<Show when={isLoggedIn()} fallback={<LoginForm />}>
  <Dashboard />
</Show>
```

Use `Switch`/`Match` for multi-branch conditionals:

```typescript
<Switch fallback={<DefaultView />}>
  <Match when={status() === "loading"}><Loading /></Match>
  <Match when={status() === "error"}><Error /></Match>
  <Match when={status() === "success"}><Success /></Match>
</Switch>
```

Reference: [SolidJS `<Show>` Component](https://docs.solidjs.com/reference/components/show)

## Use Switch/Match for Multi-Condition Rendering

**Impact: MEDIUM (unreadable nested conditionals, potential remount bugs)**

When rendering one of several mutually exclusive states (loading, error, success, empty), use `<Switch>/<Match>` instead of nested `<Show>` components or chained ternaries. `Switch/Match` is pattern-matching for JSX — only the first matching branch renders.

**Incorrect (nested Show components):**

```typescript
<Show when={!isLoading() && !error()}>
  <Show when={data()}>
    <DataView data={data()} />
  </Show>
  <Show when={!data()}>
    <EmptyState />
  </Show>
</Show>
<Show when={isLoading()}>
  <Loading />
</Show>
<Show when={error()}>
  <ErrorDisplay error={error()} />
</Show>
```

**Correct (Switch/Match for clear pattern matching):**

```typescript
import { Switch, Match } from "solid-js"

<Switch fallback={<EmptyState />}>
  <Match when={isLoading()}>
    <Loading />
  </Match>
  <Match when={error()}>
    <ErrorDisplay error={error()} />
  </Match>
  <Match when={data()}>
    {(resolvedData) => <DataView data={resolvedData()} />}
  </Match>
</Switch>
```

**Notes:**
- `Switch` evaluates `Match` children top-to-bottom and renders only the first truthy match
- The `fallback` prop on `Switch` acts as the default/else branch
- `Match` supports the same callback-children pattern as `Show` for type narrowing
- Use `Show` for simple boolean toggles; use `Switch/Match` when you have 3+ branches

Reference: [SolidJS Switch/Match docs](https://docs.solidjs.com/reference/components/switch-and-match)

# 6. SolidStart Patterns

**Impact: MEDIUM-HIGH** — SolidStart-specific patterns for routing, server functions, middleware, SSR, and deployment. Includes createAsync + query patterns, "use server" validation, and file-based routing best practices.

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
import { action, revalidate, redirect } from "@solidjs/router"

const addPost = action(async (formData: FormData) => {
  "use server"
  await db.insert("posts").values({ title: formData.get("title") })
  revalidate(getPosts) // re-runs the getPosts query cache
}, "addPost")
```

Reference: [SolidStart Actions](https://docs.solidjs.com/solid-start/building-your-application/actions)

## Use createAsync + query() for Data Loading in SolidStart

**Impact: HIGH (missing cache dedup, improper invalidation, waterfall fetches)**

SolidStart's modern data fetching pattern uses `query()` for cached server functions and `createAsync` for non-blocking consumption. `createResource` is the lower-level primitive — it doesn't integrate with SolidStart's cache or router preloading.

**Incorrect (createResource — no cache dedup or preloading):**

```typescript
function UserPage() {
  const params = useParams()
  const [user] = createResource(
    () => params.id,
    (id) => fetchUser(id)
  )
  return <Show when={user()}>{u => <Profile user={u()} />}</Show>
}
```

**Correct (query + createAsync — cached, deduped, preloadable):**

```typescript
import { query, createAsync } from "@solidjs/router"

const getUser = query(async (id: string) => {
  "use server"
  return db.users.findUnique({ where: { id } })
}, "user")

// Route preload
export const route = {
  load: ({ params }) => getUser(params.id)
}

function UserPage() {
  const params = useParams()
  const user = createAsync(() => getUser(params.id))
  return <Show when={user()}>{u => <Profile user={u()} />}</Show>
}
```

**Key benefits of query + createAsync:**
- Automatic deduplication — 2 identical requests never fly out
- Route preloading — data fetches start during navigation, not after render
- Cache invalidation via `revalidate()`
- Non-blocking — renders using Suspense boundaries, no waterfalls

Reference: [SolidStart Data Loading](https://docs.solidjs.com/solid-start/building-your-application/data-loading)

## Use deferStream for Header-Modifying Queries

**Impact: MEDIUM ("headers already sent" errors when server functions set cookies or redirect)**

Once SolidStart begins streaming HTML, HTTP headers are locked. If a `createAsync` query modifies headers (sets cookies, triggers redirects), it must resolve *before* streaming starts. Use `deferStream: true` to hold the stream until that query completes.

**Incorrect (streaming starts before auth query resolves):**

```typescript
export default function ProtectedPage() {
  // This query sets session cookies and may redirect
  const user = createAsync(() => getCurrentUser())

  return (
    <Suspense fallback={<Loading />}>
      <Dashboard user={user()} />
    </Suspense>
  )
  // ERROR: getCurrentUser() tries to set cookies after streaming began
}
```

**Correct (deferStream holds the stream for header-modifying queries):**

```typescript
export default function ProtectedPage() {
  // deferStream: true — stream waits for this query before sending headers
  const user = createAsync(() => getCurrentUser(), { deferStream: true })

  return (
    <Suspense fallback={<Loading />}>
      <Dashboard user={user()} />
    </Suspense>
  )
}
```

**When to use deferStream:**
- Server functions that call `setCookie()` or `deleteCookie()`
- Server functions that may `throw redirect()`
- Auth/session queries that gate the entire page

**When NOT to use deferStream:**
- Read-only data queries — let them stream normally
- Queries inside nested Suspense boundaries that don't touch headers

Reference: [SolidStart createAsync](https://docs.solidjs.com/reference/solid-router/data-apis/create-async)

## Use createMiddleware() for Centralized Auth and Request Processing

**Impact: HIGH (duplicated auth checks, inconsistent guard logic, missed routes)**

SolidStart middleware runs before route handlers, providing a single place for auth guards, redirects, and request logging. Without it, auth checks get duplicated across every server function.

**Incorrect (duplicated auth checks in every server function):**

```typescript
const getProfile = query(async () => {
  "use server"
  const session = await getSession()
  if (!session.userId) throw redirect("/login") // repeated everywhere
  return db.users.get(session.userId)
}, "profile")

const updateProfile = action(async (formData: FormData) => {
  "use server"
  const session = await getSession()
  if (!session.userId) throw redirect("/login") // same check, duplicated
  // ...
})
```

**Correct (centralized middleware — app.config.ts + src/middleware/index.ts):**

```typescript
// app.config.ts
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  middleware: "src/middleware/index.ts",
})
```

```typescript
// src/middleware/index.ts
import { createMiddleware } from "@solidjs/start/middleware"
import { redirect } from "@solidjs/router"
import { getCookie } from "vinxi/http"
import type { FetchEvent } from "@solidjs/start/server"

const PROTECTED_PATHS = ["/dashboard", "/settings", "/profile"]

function authGuard(event: FetchEvent) {
  const { pathname } = new URL(event.request.url)
  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    const session = getCookie(event.nativeEvent, "session")
    if (!session) return redirect("/login")
    event.locals.sessionId = session
  }
}

function logger(event: FetchEvent) {
  event.locals.startTime = Date.now()
}

function logDuration(event: FetchEvent) {
  const ms = Date.now() - event.locals.startTime
  console.log(`${event.request.method} ${event.request.url} — ${ms}ms`)
}

export default createMiddleware({
  onRequest: [authGuard, logger],
  onBeforeResponse: [logDuration],
})
```

**Accessing middleware data in server functions via getRequestEvent():**

```typescript
import { getRequestEvent } from "solid-js/web"
import { query } from "@solidjs/router"

const getProfile = query(async () => {
  "use server"
  const event = getRequestEvent()
  const sessionId = event?.locals?.sessionId // populated by middleware
  return db.users.getBySession(sessionId)
}, "profile")
```

**Key points:**
- `onRequest` runs before route handlers; `onBeforeResponse` runs after
- Return `redirect()` or `json()` from `onRequest` to short-circuit
- `event.locals` passes request-scoped data to server functions
- Use `event.nativeEvent` for `vinxi/http` cookie utilities
- Must be a default export from the configured middleware file

Reference: [SolidStart Middleware](https://docs.solidjs.com/solid-start/advanced/middleware)

## Use createMiddleware with event.locals for Shared State

**Impact: HIGH (avoids global state leaks between requests and duplicated auth checks)**

SolidStart middleware runs before route handlers and server functions. Use `createMiddleware` with `event.locals` to share data (auth session, feature flags, request metadata) between middleware and downstream code — never use module-level globals which leak between requests.

**Incorrect (global state — leaks between concurrent requests):**

```typescript
// ❌ Module-level state shared across ALL requests
let currentUser: User | null = null;

export default defineConfig({
  middleware: async (event) => {
    currentUser = await verifySession(event.request);
  },
});

// In a server function
async function getData() {
  "use server";
  // ❌ currentUser could be from a different request
  if (!currentUser) throw new Error("Unauthorized");
}
```

**Correct (event.locals — scoped to the request):**

```typescript
// middleware.ts
import { createMiddleware } from "@solidjs/start/middleware";

export default createMiddleware({
  onRequest: [
    async (event) => {
      const session = await verifySession(event.request);
      event.locals.user = session?.user ?? null;
      event.locals.requestId = crypto.randomUUID();

      // Return a Response for early termination (e.g., auth guard)
      if (!session && isProtectedRoute(event.request.url)) {
        return new Response(null, {
          status: 302,
          headers: { Location: "/login" },
        });
      }
    },
  ],
  onBeforeResponse: [
    async (event) => {
      // Add headers, log timing, etc.
      event.response.headers.set("X-Request-Id", event.locals.requestId);
    },
  ],
});
```

```typescript
// app.config.ts — register middleware
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "./src/middleware.ts",
});
```

```typescript
// In server functions — access event.locals
import { getRequestEvent } from "solid-js/web";

async function getData() {
  "use server";
  const event = getRequestEvent()!;
  if (!event.locals.user) throw new Error("Unauthorized");
  return db.getData(event.locals.user.id);
}
```

**Key points:**
- `event.locals` is typed and scoped to a single request lifecycle
- Return a `Response` from `onRequest` for early termination (redirects, 401s)
- Register middleware in `app.config.ts`, not in route files
- Access locals in server functions via `getRequestEvent()`

Reference: [SolidStart Middleware](https://docs.solidjs.com/solid-start/advanced/middleware)

## Use createMiddleware for Cross-Cutting Concerns

**Impact: HIGH (centralizes auth, logging, and headers across all routes)**

SolidStart middleware runs for every request before route handlers execute. Use `createMiddleware` for authentication, logging, CORS headers, and request validation. Configure it in `app.config.ts`.

**Incorrect (duplicating auth checks in every server function):**

```tsx
// src/api/users.ts
const getUser = query(async (id: string) => {
  "use server";
  const session = await getSession(); // repeated everywhere
  if (!session) throw redirect("/login");
  return db.users.find(id);
}, "user");

// src/api/posts.ts
const getPosts = query(async () => {
  "use server";
  const session = await getSession(); // repeated everywhere
  if (!session) throw redirect("/login");
  return db.posts.list();
}, "posts");
```

**Correct (middleware handles auth once):**

```tsx
// src/middleware.ts
import { createMiddleware } from "@solidjs/start/middleware";

export default createMiddleware({
  onRequest: [
    (event) => {
      const session = getSessionFromCookie(event.request.headers);
      if (!session && isProtectedRoute(event.request.url)) {
        return Response.redirect("/login");
      }
      // Attach session to event locals for downstream use
      event.locals.session = session;
    },
  ],
  onBeforeResponse: [
    (event) => {
      event.response.headers.set("X-Request-Id", crypto.randomUUID());
    },
  ],
});

// app.config.ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "./src/middleware.ts",
});
```

Middleware runs in order — place auth before logging if you need user context in logs.

Reference: [SolidStart Docs - createMiddleware](https://docs.solidjs.com/solid-start/reference/server/create-middleware)

## Always Define Route Preload Functions

**Impact: HIGH (data fetches delayed until after navigation completes and component renders)**

Without a `load` function, data fetching only starts when the route component renders. With preloading, data fetching starts during navigation — the page appears ready faster.

**Incorrect (no preload — fetch starts after render):**

```typescript
// routes/users/[id].tsx
function UserPage() {
  const params = useParams()
  const user = createAsync(() => getUser(params.id))
  // Fetch starts AFTER route component renders
  return <Suspense><Profile user={user()} /></Suspense>
}
```

**Correct (route preload — fetch starts during navigation):**

```typescript
// routes/users/[id].tsx
import { query, createAsync } from "@solidjs/router"

const getUser = query(async (id: string) => {
  "use server"
  return db.users.findUnique({ where: { id } })
}, "user")

export const route = {
  load: ({ params }) => getUser(params.id)  // Fetch starts during navigation
}

function UserPage() {
  const params = useParams()
  const user = createAsync(() => getUser(params.id))
  // Data may already be available by the time component renders
  return <Suspense><Profile user={user()} /></Suspense>
}
```

Reference: [SolidStart Routing](https://docs.solidjs.com/solid-start/building-your-application/routing)

## Validate All Inputs Inside "use server" Functions

**Impact: HIGH (server functions are public HTTP endpoints — unvalidated input leads to injection/data leaks)**

Every `"use server"` function compiles to a public HTTP POST endpoint. TypeScript types are erased at runtime — an attacker can send any payload. Always validate inputs with a runtime schema (Zod), check auth inside each function, and never return raw internal errors.

**Incorrect (trusting TypeScript types at runtime):**

```typescript
async function updateProfile(userId: string, data: ProfileData) {
  "use server";
  // ❌ No input validation — attacker can send { role: "admin" }
  // ❌ No auth check — anyone can update any profile
  await db.users.update({ where: { id: userId }, data });
}
```

**Correct (validate inputs + check auth):**

```typescript
import { z } from "zod";
import { getSession } from "./auth";

const ProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
});

async function updateProfile(userId: string, rawData: unknown) {
  "use server";

  // 1. Auth check
  const session = await getSession();
  if (!session || session.userId !== userId) {
    throw new Error("Unauthorized");
  }

  // 2. Runtime validation
  const result = ProfileSchema.safeParse(rawData);
  if (!result.success) {
    throw new Error("Invalid input");
  }

  // 3. Use validated data only
  await db.users.update({
    where: { id: userId },
    data: result.data,
  });
}
```

**Security checklist for server functions:**
- Validate all inputs with Zod `safeParse` (not just `parse` — catch errors gracefully)
- Check authentication AND authorization inside each function
- Never return raw database errors or stack traces
- Treat `"use server"` as a trust boundary — same rigor as a REST endpoint

Reference: [SolidStart - "use server"](https://docs.solidjs.com/solid-start/reference/server/use-server)

## Use Nested Suspense Boundaries for Streaming SSR

**Impact: HIGH (entire page blocks until slowest query resolves)**

SolidStart streams HTML by default. Each `<Suspense>` boundary defines an independent streaming chunk — without them, the entire page waits for the slowest data fetch. Nested Suspense boundaries let fast queries render immediately while slow ones show skeletons.

**Incorrect (no Suspense — entire page blocks):**

```typescript
export default function Dashboard() {
  const user = createAsync(() => getUser())    // 50ms
  const stats = createAsync(() => getStats())  // 200ms
  const feed = createAsync(() => getFeed())    // 800ms

  return (
    <div>
      <UserHeader user={user()} />
      <StatsPanel stats={stats()} />
      <ActivityFeed items={feed()} />
    </div>
  )
  // Nothing renders until getFeed() resolves at 800ms
}
```

**Correct (nested Suspense — each section streams independently):**

```typescript
import { Suspense, ErrorBoundary } from "solid-js"
import { query, createAsync } from "@solidjs/router"
import type { RouteDefinition } from "@solidjs/router"

export const route = {
  preload: () => { getUser(); getStats(); getFeed() }
} satisfies RouteDefinition

export default function Dashboard() {
  const user = createAsync(() => getUser())
  const stats = createAsync(() => getStats())
  const feed = createAsync(() => getFeed())

  return (
    <div>
      {/* Streams at 50ms */}
      <ErrorBoundary fallback={<div>Error loading user</div>}>
        <Suspense fallback={<UserSkeleton />}>
          <UserHeader user={user()} />
        </Suspense>
      </ErrorBoundary>

      <div class="grid grid-cols-2">
        {/* Streams at 200ms */}
        <Suspense fallback={<StatsSkeleton />}>
          <StatsPanel stats={stats()} />
        </Suspense>
        {/* Streams at 800ms */}
        <Suspense fallback={<FeedSkeleton />}>
          <ActivityFeed items={feed()} />
        </Suspense>
      </div>
    </div>
  )
}
```

**Key points:**
- Each `<Suspense>` boundary streams independently — fast queries don't wait for slow ones
- `ErrorBoundary` wraps `Suspense` (not inside it) to catch async failures
- `route.preload` fires all queries during navigation, before component renders
- Avoid `<Show when={data()}>` inside `<Suspense>` — it defeats Suspense pre-creation
- Streaming is the default with `ssr: true` (SolidStart default)

Reference: [SolidStart Data Loading](https://docs.solidjs.com/solid-start/building-your-application/data-loading)

## Always Validate "use server" Function Inputs

**Impact: CRITICAL (security vulnerability — client can send any data across RPC boundary)**

`"use server"` functions are called via RPC from the client. TypeScript types don't exist at runtime — the client can send anything. Always validate inputs server-side.

**Incorrect (trusting TypeScript types across RPC boundary):**

```typescript
async function updateUser(email: string, name: string) {
  "use server"
  // email might not be a string! Could be an object, null, or malicious input
  await db.users.update({ email, name })
}
```

**Correct (validate all inputs server-side):**

```typescript
import { z } from "zod"

const UpdateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
})

async function updateUser(input: unknown) {
  "use server"
  const { email, name } = UpdateUserSchema.parse(input)
  await db.users.update({ email, name })
}
```

**Also**: Never leak error stacks to the client. Throw serializable error objects:

```typescript
async function createPost(input: unknown) {
  "use server"
  try {
    const data = PostSchema.parse(input)
    return await db.posts.create(data)
  } catch (e) {
    throw { message: "Failed to create post", code: "CREATE_FAILED" }
  }
}
```

Reference: [SolidStart "use server"](https://docs.solidjs.com/solid-start/reference/server/use-server)

# 7. Performance Optimization

**Impact: MEDIUM** — Code splitting, lazy loading, bundle optimization, memoization, and Suspense boundary placement. SolidJS is fast by default, but lazy loading and strategic Suspense boundaries still matter for large apps.

## Analyze and Optimize Bundle Size

**Impact: MEDIUM (reduces initial load time and improves TTI)**

SolidJS apps are small by default (~7KB runtime), but dependencies can bloat bundles quickly. Measure before optimizing, and target these metrics for production apps.

**Target metrics:**
- Initial bundle: < 200KB gzipped
- Per-route chunk: < 50KB gzipped
- Time to Interactive: < 3s on 4G
- Largest Contentful Paint: < 2.5s

**Incorrect (heavy imports without analysis or tree-shaking):**

```tsx
// ❌ Named import from lodash pulls entire library (72KB)
import { debounce } from "lodash"

// ❌ moment.js bundles all locales (67KB+)
import moment from "moment"

// ❌ No bundle analysis configured — bloat goes unnoticed
import { defineConfig } from "vite"
export default defineConfig({
  plugins: [solidPlugin()],
})
```

**Correct (tree-shakeable imports + bundle analysis):**

```tsx
// ✅ Direct module import (1KB)
import debounce from "lodash-es/debounce"

// ✅ Lightweight alternative (2KB) or Temporal API
import dayjs from "dayjs"

// ✅ Bundle visualizer configured
import { defineConfig } from "vite"
import solidPlugin from "vite-plugin-solid"
import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig({
  plugins: [
    solidPlugin(),
    visualizer({ open: true, gzipSize: true }),
  ],
})
```

**Tree-shaking checklist:**
- Use `lodash-es` instead of `lodash`
- Use `date-fns` or `dayjs` instead of `moment`
- Use `@iconify-json/*` with unplugin-icons instead of bundling icon libraries
- Set `"sideEffects": false` in package.json for your library code
- Use dynamic imports for heavy components: `lazy(() => import("./HeavyChart"))`

Reference: [Vite Build Optimization](https://vite.dev/guide/build)

## Use createSelector for Single-Selection in Large Lists

**Impact: MEDIUM (O(1) updates instead of O(n) — only 2 items update on selection change)**

Without `createSelector`, every item in a list checks `selectedId() === item.id` on selection change — all re-run. With it, only the previously-selected and newly-selected items update.

**Incorrect (O(n) — all items re-evaluate on selection change):**

```typescript
const [selectedId, setSelectedId] = createSignal<string | null>(null)

<For each={items()}>
  {(item) => (
    <div classList={{ selected: selectedId() === item.id }}>
      {item.name}
    </div>
  )}
</For>
```

**Correct (O(1) — only 2 items update):**

```typescript
import { createSelector } from "solid-js"

const [selectedId, setSelectedId] = createSignal<string | null>(null)
const isSelected = createSelector(selectedId)

<For each={items()}>
  {(item) => (
    <div classList={{ selected: isSelected(item.id) }}>
      {item.name}
    </div>
  )}
</For>
```

Use for lists with 50+ items where selection performance matters.

Reference: [SolidJS createSelector](https://docs.solidjs.com/reference/reactive-utilities/create-selector)

## Lazy Load Heavy Components

**Impact: MEDIUM (30-60% initial bundle reduction for modal-heavy apps)**

Use `lazy()` for components that aren't visible on initial render: modals, settings panels, charts, editors. Don't lazy load small components — the overhead isn't worth it.

**When to lazy load:**

```typescript
import { lazy } from "solid-js"

// ✅ DO lazy load: modals, charts, editors, large forms
const SettingsModal = lazy(() => import("./modals/SettingsModal"))
const MarkdownEditor = lazy(() => import("./components/MarkdownEditor"))
const DataVisualization = lazy(() => import("./components/DataVisualization"))

// ❌ DON'T lazy load: small components, frequently-used UI elements
// const Badge = lazy(() => import("./Badge"))  // Overhead not worth it
```

**Route-level splitting:**

```typescript
import { lazy } from "solid-js"
import { Route } from "@solidjs/router"

const Home = lazy(() => import("./screens/Home"))
const Settings = lazy(() => import("./screens/Settings"))
const Profile = lazy(() => import("./screens/Profile"))

function App() {
  return (
    <Routes>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />
      <Route path="/profile" component={Profile} />
    </Routes>
  )
}
```

Always pair with Suspense and skeleton components for a smooth loading experience.

Reference: [SolidJS lazy](https://docs.solidjs.com/reference/component-apis/lazy)

## Use createMemo for Expensive Derived Computations

**Impact: MEDIUM (prevents redundant expensive recomputations)**

`createMemo` caches derived values and only recomputes when its dependencies change. Use it for filtering, sorting, or transforming large datasets. Don't use it for simple property access — the overhead isn't worth it.

**Incorrect (expensive computation runs every time it's accessed):**

```typescript
// ❌ Without memo, this runs on every access in JSX
const getFilteredItems = () =>
  allItems()
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))

// Every component reading getFilteredItems() triggers a re-filter
<For each={getFilteredItems()}>...</For>
<span>Count: {getFilteredItems().length}</span>
```

**Correct (createMemo caches the result):**

```typescript
import { createMemo } from "solid-js"

// ✅ Only recomputes when allItems() changes
const filteredItems = createMemo(() =>
  allItems()
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name))
)

// Multiple accesses use cached value
<For each={filteredItems()}>...</For>
<span>Count: {filteredItems().length}</span>
```

**Don't over-memo:**

```typescript
// ❌ Unnecessary — simple property access doesn't need memoization
const name = createMemo(() => user().name)

// ✅ Just access it directly
<span>{user().name}</span>
```

**Notes:**
- `createMemo` is lazy — it only runs when read and when dependencies changed
- Chain memos for multi-step transformations: filter → sort → paginate
- Don't wrap simple getters or property access — the memo overhead costs more than it saves

## Use createRenderEffect for Synchronous DOM Measurements

**Impact: MEDIUM (layout flicker from deferred DOM reads)**

When you need to measure or synchronize DOM layout before the browser paints (e.g., reading element dimensions, adjusting scroll position), use `createRenderEffect` instead of `createEffect`. Regular effects run after paint, which can cause visible flicker when the measurement drives a visual update.

**Incorrect (createEffect runs after paint — flicker visible):**

```typescript
import { createEffect, createSignal } from "solid-js"

function AutoLayout() {
  let containerRef: HTMLDivElement

  // Runs AFTER paint — user sees the un-adjusted layout briefly
  createEffect(() => {
    const height = containerRef.offsetHeight
    updateLayout(height)  // Visual adjustment flickers
  })

  return <div ref={containerRef!}>...</div>
}
```

**Correct (createRenderEffect runs during render, before paint):**

```typescript
import { createRenderEffect } from "solid-js"

function AutoLayout() {
  let containerRef: HTMLDivElement

  // Runs synchronously during render — no flicker
  createRenderEffect(() => {
    const height = containerRef.offsetHeight
    updateLayout(height)
  })

  return <div ref={containerRef!}>...</div>
}
```

**Notes:**
- `createRenderEffect` blocks rendering, so avoid heavy computation — keep it limited to DOM reads and immediate style updates
- Good use cases: scroll position sync, element dimension measurements, immediate style calculations
- Bad use cases: data fetching, complex state updates, anything async
- For one-time setup after mount, `onMount` is often a better choice

Reference: [SolidJS createRenderEffect docs](https://docs.solidjs.com/reference/secondary-primitives/create-render-effect)

## Use lazy() for Route-Level Code Splitting

**Impact: HIGH (reduces initial bundle by 40-70% in multi-route apps)**

Use `lazy()` to split each route into its own chunk. This is the highest-impact code splitting strategy — users only download the code for the route they visit. Combine with Suspense for loading states.

**Incorrect (all routes in main bundle):**

```typescript
import Home from "./screens/Home"
import Settings from "./screens/Settings"
import Profile from "./screens/Profile"
import Admin from "./screens/Admin"

// ❌ All 4 screens included in initial bundle
function App() {
  return (
    <Routes>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
    </Routes>
  )
}
```

**Correct (lazy-loaded route chunks):**

```typescript
import { lazy } from "solid-js"
import { Route, Routes } from "@solidjs/router"

const Home = lazy(() => import("./screens/Home"))
const Settings = lazy(() => import("./screens/Settings"))
const Profile = lazy(() => import("./screens/Profile"))
const Admin = lazy(() => import("./screens/Admin"))

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" component={Home} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin" component={Admin} />
      </Routes>
    </Suspense>
  )
}
```

**Notes:**
- Only lazy-load routes and heavy components (modals, charts, editors) — small components aren't worth the overhead
- Combine with route preloading (`preload` in SolidStart) to start loading before navigation
- Target < 50KB per route chunk for optimal loading
- Don't lazy-load the home/landing route — it should be in the main bundle

## Use Skeleton Components as Suspense Fallbacks

**Impact: MEDIUM (layout shift and visual jank during loading)**

Generic spinners or "Loading..." text inside Suspense fallbacks cause layout shift when the real content arrives. Use skeleton components that match the final layout dimensions so the page stays stable during loading.

**Incorrect (generic fallback causes layout shift):**

```typescript
<Suspense fallback={<p>Loading...</p>}>
  <Dashboard />  {/* When this loads, entire layout jumps */}
</Suspense>
```

**Correct (skeleton matches final dimensions):**

```typescript
function CardSkeleton() {
  return (
    <div class="animate-pulse">
      <div class="h-4 bg-muted rounded w-3/4 mb-2" />
      <div class="h-4 bg-muted rounded w-1/2" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div class="grid grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}

<Suspense fallback={<DashboardSkeleton />}>
  <Dashboard />
</Suspense>
```

**Notes:**
- Compose small skeleton primitives into page-level skeletons that mirror actual layout
- For app-level loading, wrap the router in a Suspense with a full-page skeleton (sidebar + header + content area)
- Skeletons should use the same grid, flex, and spacing as the real content
- Tailwind's `animate-pulse` class provides the standard shimmer effect

Reference: [SolidJS Suspense docs](https://docs.solidjs.com/reference/components/suspense)

## Use useTransition for Non-Blocking Async Updates

**Impact: MEDIUM (UI freezes during async state transitions)**

When switching between views that trigger Suspense boundaries (tab switches, route transitions), wrap the state update in `startTransition` from `useTransition`. This keeps the current view visible with a pending indicator while the new view loads, instead of flashing a loading fallback.

**Incorrect (direct state update triggers immediate Suspense fallback):**

```typescript
const [tab, setTab] = createSignal("home")

// Clicking a tab instantly shows the Suspense fallback spinner,
// hiding the current content while the new tab loads
const switchTab = (newTab: string) => {
  setTab(newTab)
}

<Suspense fallback={<Loading />}>
  <TabContent tab={tab()} />  {/* Content disappears during load */}
</Suspense>
```

**Correct (useTransition keeps current content visible):**

```typescript
import { useTransition, createSignal, Suspense } from "solid-js"

function TabSwitcher() {
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = createSignal("home")

  const switchTab = (newTab: string) => {
    startTransition(() => setTab(newTab))
  }

  return (
    <>
      <TabButtons
        onSelect={switchTab}
        pending={isPending()}
      />
      <Suspense fallback={<Loading />}>
        <div style={{ opacity: isPending() ? 0.6 : 1 }}>
          <TabContent tab={tab()} />
        </div>
      </Suspense>
    </>
  )
}
```

**Notes:**
- `startTransition` delays the state update until the new Suspense boundary resolves
- `isPending()` is a reactive signal that is `true` while the transition is in progress — use it for subtle loading indicators (opacity, spinners on tabs)
- This pattern is especially valuable for route transitions where the Suspense fallback would otherwise flash
- Only wrap updates that trigger Suspense; non-async updates gain nothing from transitions

Reference: [SolidJS useTransition docs](https://docs.solidjs.com/reference/reactive-utilities/use-transition)

# 8. Testing

**Impact: LOW-MEDIUM** — Testing reactive code requires understanding createRoot, renderHook, and how effects run synchronously in test contexts. Solid Query mocking and async testing have unique patterns.

## Use waitFor for Async Component Assertions

**Impact: LOW (flaky tests from timing-dependent assertions)**

When testing components that load data asynchronously (via `createResource`, `createAsync`, or Solid Query), use `waitFor` from `@solidjs/testing-library` to wait for the loading state to resolve. Direct assertions on async content fail because the data is not yet available when the assertion runs.

**Incorrect (asserting before async content loads):**

```typescript
import { render, screen } from "@solidjs/testing-library"

it("shows user data", () => {
  render(() => <UserProfile userId="123" />)

  // Fails — component is still showing loading fallback
  expect(screen.getByText("John Doe")).toBeInTheDocument()
})
```

**Correct (waitFor polls until assertion passes):**

```typescript
import { render, screen, waitFor } from "@solidjs/testing-library"

it("shows user data", async () => {
  render(() => <UserProfile userId="123" />)

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
  })

  expect(screen.getByText("John Doe")).toBeInTheDocument()
})
```

**Notes:**
- `waitFor` retries the assertion function on a short interval until it passes or times out
- Always `await` the `waitFor` call — forgetting `await` causes the test to pass vacuously
- For simpler cases, `findByText` combines query + waitFor: `await screen.findByText("John Doe")`
- Set a custom timeout if your async operation is slow: `waitFor(fn, { timeout: 5000 })`

Reference: [Solid Testing Library docs](https://github.com/solidjs/solid-testing-library)

## Wrap Reactive Test Code in createRoot

**Impact: LOW-MEDIUM (leaked reactive contexts, orphaned effects in tests)**

Testing reactive primitives (signals, stores, effects) requires a reactive owner context. Use `createRoot` to provide one, and always call `dispose` for cleanup.

**Incorrect (reactive primitives without createRoot):**

```typescript
import { createSignal, createEffect } from "solid-js"

it("tracks signal changes", () => {
  // ❌ No reactive owner — createEffect has no context to register with
  const [count, setCount] = createSignal(0)
  const values: number[] = []

  createEffect(() => {
    values.push(count()) // May warn: "computations created outside a createRoot"
  })

  setCount(1)
  expect(values).toEqual([0, 1]) // Unreliable — effect may not track
})
```

**Correct (wrapped in createRoot with dispose):**

```typescript
import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"

it("toggles items independently", () => {
  createRoot(dispose => {
    const [expanded, setExpanded] = createStore<boolean[]>([])

    setExpanded(0, true)
    expect(expanded[0]).toBe(true)

    setExpanded(1, true)
    expect(expanded[0]).toBe(true)   // unchanged
    expect(expanded[1]).toBe(true)

    dispose()  // Clean up reactive context
  })
})
```

**For hooks, use `renderHook`:**

```typescript
import { renderHook } from "@solidjs/testing-library"

it("increments counter", () => {
  const { result } = renderHook(() => useCounter())
  expect(result.count()).toBe(0)
  result.increment()
  expect(result.count()).toBe(1)
})
```

Reference: [Solid Testing Library](https://github.com/solidjs/solid-testing-library)

## Write documentation tests as living pattern references

**Impact: LOW-MEDIUM — pattern knowledge lost when not captured in test suite**

Use describe/it blocks to document recommended patterns as executable test files. These serve as searchable, always-up-to-date reference material that breaks if the API changes.

**Incorrect (patterns documented only in comments or markdown):**

```typescript
// patterns.md or inline comments
// When working with stores, use the path syntax for nested updates:
// setState("user", "profile", "name", newName)
//
// Don't do: state.user.profile.name = newName
```

**Correct (patterns captured as runnable test documentation):**

```typescript
import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"

describe("Store update patterns", () => {
  it("documents: nested path updates for deep store state", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({
        user: { profile: { name: "Alice", age: 30 } },
      })

      // ✅ Path syntax for nested updates — triggers fine-grained reactivity
      setState("user", "profile", "name", "Bob")
      expect(state.user.profile.name).toBe("Bob")

      // ✅ Functional update at nested path
      setState("user", "profile", "age", (prev) => prev + 1)
      expect(state.user.profile.age).toBe(31)

      dispose()
    })
  })

  it("documents: array item updates by index", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({ items: ["a", "b", "c"] })

      // ✅ Update specific array index — only that index rerenders
      setState("items", 1, "B")
      expect(state.items[1]).toBe("B")

      dispose()
    })
  })
})
```

Documentation tests are valuable because:
- They break when APIs change, unlike markdown docs
- They're discoverable via test runner output and IDE search
- They serve as copy-paste starting points for real code

Reference: [Vitest — Organizing Tests](https://vitest.dev/guide/)

## Test effects by tracking signal changes in createRoot

**Impact: LOW-MEDIUM — missed effect regressions go undetected**

Effects run synchronously in SolidJS test contexts. Test them by collecting values in an array inside `createRoot`, then asserting after each signal update.

**Incorrect (testing effects without capturing values):**

```typescript
import { createRoot, createSignal, createEffect } from "solid-js"

it("effect runs on signal change", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0)

    // ❌ No way to verify the effect actually ran or saw correct values
    createEffect(() => {
      console.log(count()) // Just logging — no assertion possible
    })

    setCount(1)
    dispose()
  })
})
```

**Correct (collecting effect calls for assertion):**

```typescript
import { createRoot, createSignal, createEffect } from "solid-js"

it("effect runs on signal change", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0)
    const effectCalls: number[] = []

    createEffect(() => {
      effectCalls.push(count())
    })

    expect(effectCalls).toEqual([0]) // Effect ran once on init

    setCount(1)
    expect(effectCalls).toEqual([0, 1]) // Effect ran again

    setCount(5)
    expect(effectCalls).toEqual([0, 1, 5]) // Tracks every change

    dispose()
  })
})
```

The pattern works because SolidJS effects execute synchronously during tests, so assertions immediately after `setCount()` see the updated values. Always call `dispose()` to clean up the reactive scope.

Reference: [SolidJS Testing Guide](https://docs.solidjs.com/guides/testing)

## Co-locate test files alongside source files

**Impact: LOW-MEDIUM — poor test discoverability and maintenance**

Place test files next to their source files using the `*.test.ts` / `*.test.tsx` naming convention. This makes tests easy to find and keeps related code together.

**Incorrect (separate test directory mirroring source structure):**

```
src/
├── components/
│   ├── Counter.tsx
│   └── UserProfile.tsx
├── hooks/
│   └── useCounter.ts
└── lib/
    └── utils.ts
tests/
├── components/
│   ├── Counter.test.tsx      ← Far from source, paths drift
│   └── UserProfile.test.tsx
├── hooks/
│   └── useCounter.test.tsx
└── lib/
    └── utils.test.ts
```

**Correct (co-located test files):**

```
src/
├── components/
│   ├── Counter.tsx
│   ├── Counter.test.tsx      ← Right next to source
│   ├── UserProfile.tsx
│   └── UserProfile.test.tsx
├── hooks/
│   ├── useCounter.ts
│   └── useCounter.test.tsx
└── lib/
    ├── utils.ts
    └── utils.test.ts
```

Co-location ensures:
- Tests are trivially discoverable — no mental mapping between directories
- Moving or renaming a component naturally includes its test
- Vitest and Bun test runner pick up `*.test.*` files automatically with no extra config

Reference: [Vitest Configuration](https://vitest.dev/config/#include)

## Use vi.hoisted for Mock Definitions

**Impact: LOW (mock reference errors or stale mock state)**

When mocking modules in vitest, define mock implementations inside `vi.hoisted` so they are available before `vi.mock` runs. Without hoisting, mock references may be undefined when the mock factory executes, causing confusing errors.

**Incorrect (mock function defined after vi.mock — hoisting issue):**

```typescript
import { vi } from "vitest"

// vi.mock is hoisted to the top of the file at runtime
vi.mock("@/api/users", () => ({
  fetchUser: mockFetchUser  // ReferenceError: mockFetchUser is not defined
}))

// This line runs AFTER vi.mock in source, but vi.mock is hoisted above it
const mockFetchUser = vi.fn()
```

**Correct (vi.hoisted ensures mocks are defined before vi.mock runs):**

```typescript
import { beforeEach, vi } from "vitest"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    fetchUser: vi.fn(() => Promise.resolve({ id: "1", name: "Test" })),
    useAuth: vi.fn(() => ({ user: () => ({ uid: "test-123" }) }))
  }
}))

vi.mock("@/api/users", () => ({
  fetchUser: mocks.fetchUser
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mocks.useAuth
}))

beforeEach(() => {
  vi.clearAllMocks()
})
```

**Notes:**
- `vi.hoisted` runs its callback before any `vi.mock` calls, regardless of source order
- Group related mocks into a single `vi.hoisted` block for clarity
- Always call `vi.clearAllMocks()` in `beforeEach` to reset call counts and return values between tests
- This pattern applies to all vitest projects, not just SolidJS, but is especially common when mocking hooks and API modules

Reference: [Vitest vi.hoisted docs](https://vitest.dev/api/vi.html#vi-hoisted)

## Use render() and Testing Library for Component Tests

**Impact: MEDIUM (correct component testing prevents false positives)**

Use `@solidjs/testing-library` with `render(() => <Component />)` — note the arrow function wrapper, which is required for SolidJS's rendering model. Query by role and accessible names for resilient tests.

**Incorrect (missing arrow function wrapper):**

```typescript
import { render, screen } from "@solidjs/testing-library"

// ❌ Wrong: passing JSX directly instead of a function
render(<Counter />)
```

**Correct (arrow function wrapper + role-based queries):**

```typescript
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"

describe("Counter", () => {
  it("increments on click", async () => {
    render(() => <Counter />)

    const button = screen.getByRole("button")
    expect(screen.getByText("Count: 0")).toBeInTheDocument()

    fireEvent.click(button)

    expect(screen.getByText("Count: 1")).toBeInTheDocument()
  })
})
```

**Notes:**
- Always wrap in `render(() => ...)` — SolidJS components are functions that run once
- Use `renderHook(() => useMyHook())` for testing custom hooks without a component
- For async content, use `waitFor()` to wait for Suspense/resource resolution
- Use `vi.hoisted()` with `vi.mock()` for proper mock hoisting in vitest

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

## Use renderHook for Testing Custom Hooks

**Impact: LOW (boilerplate-heavy tests or missing reactive context)**

When testing custom hooks (functions that use `createSignal`, `createEffect`, etc.), use `renderHook` from `@solidjs/testing-library` instead of manually setting up `createRoot`. It provides a proper reactive and rendering context and returns the hook's result for assertions.

**Incorrect (manual createRoot boilerplate):**

```typescript
import { createRoot } from "solid-js"

it("increments counter", () => {
  createRoot(dispose => {
    const counter = useCounter()
    expect(counter.count()).toBe(0)
    counter.increment()
    expect(counter.count()).toBe(1)
    dispose()
  })
})
```

**Correct (renderHook handles the reactive context):**

```typescript
import { renderHook } from "@solidjs/testing-library"

it("increments counter", () => {
  const { result } = renderHook(() => useCounter())

  expect(result.count()).toBe(0)
  result.increment()
  expect(result.count()).toBe(1)
})
```

**Notes:**
- `renderHook` creates both a reactive owner and a DOM rendering context, which some hooks require
- The `result` object is whatever the hook function returns
- Use `createRoot` directly when testing pure reactive logic with no DOM needs (stores, signals)
- `renderHook` automatically cleans up the reactive scope when the test ends

Reference: [Solid Testing Library docs](https://github.com/solidjs/solid-testing-library)

# 9. External Interop

**Impact: LOW** — Bridging SolidJS reactivity with external APIs (browser observers, RxJS, WebSockets) via `from` and `observable`. Advanced patterns for when you need to consume or expose signals to non-Solid code.

## Use from() to Bridge Browser APIs into Reactive Signals

**Impact: LOW (clean reactive integration with matchMedia, ResizeObserver, WebSocket)**

`from()` converts any subscribe/unsubscribe pattern into a Solid signal with automatic cleanup. Use it for browser APIs, WebSockets, or any external subscription.

**Incorrect (one-shot check, won't react to changes):**

```typescript
createEffect(() => {
  const isSmall = window.matchMedia("(max-width: 768px)").matches
  if (isSmall) doSomething()  // Only checks once
})
```

**Correct (reactive, updates when condition changes):**

```typescript
function useMediaQuery(query: string): Accessor<boolean | undefined> {
  return from((set) => {
    if (typeof window === "undefined") {
      set(false)
      return () => {}
    }
    const media = window.matchMedia(query)
    set(media.matches)
    const listener = () => set(media.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  })
}

// Usage — reactive!
const isWidescreen = useMediaQuery("(min-width: 1280px)")
```

**Key rules for `from`:**
1. Always return a cleanup function (even if empty)
2. Return type is `T | undefined` until first `set()` call
3. Check `typeof window` for SSR safety

Reference: [SolidJS from()](https://docs.solidjs.com/reference/reactive-utilities/from)

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

## Use observable to Export Signals to External Libraries

**Impact: LOW (manual subscription glue code)**

When you need to expose a SolidJS signal to an external library that expects an Observable (RxJS, analytics pipelines, logging systems), use the `observable` utility instead of manually wiring up subscriptions with `createEffect`.

**Incorrect (manual effect-based bridge):**

```typescript
import { createEffect } from "solid-js"
import { Subject } from "rxjs"
import { debounceTime, distinctUntilChanged } from "rxjs/operators"

const [searchTerm, setSearchTerm] = createSignal("")
const search$ = new Subject<string>()

// Manual bridge — must manage lifecycle yourself
createEffect(() => {
  search$.next(searchTerm())
})

search$.pipe(
  debounceTime(300),
  distinctUntilChanged()
).subscribe(term => performSearch(term))
```

**Correct (observable creates the bridge automatically):**

```typescript
import { observable, createSignal } from "solid-js"
import { from as rxFrom, debounceTime, distinctUntilChanged } from "rxjs"

const [searchTerm, setSearchTerm] = createSignal("")

// Converts signal to standard Observable — lifecycle managed by Solid
const search$ = rxFrom(observable(searchTerm))

search$.pipe(
  debounceTime(300),
  distinctUntilChanged()
).subscribe(term => performSearch(term))
```

**Notes:**
- `observable` returns a standard TC39 Observable that emits whenever the signal changes
- The subscription is tied to the reactive owner scope and auto-cleans on disposal
- Use `from` (the SolidJS utility) for the reverse direction: external subscriptions into Solid signals
- Only use `observable` when you genuinely need RxJS operators or external library integration; for Solid-to-Solid communication, use signals directly

Reference: [SolidJS observable docs](https://docs.solidjs.com/reference/secondary-primitives/observable)

## Check @solid-primitives Before Building Custom Hooks

**Impact: MEDIUM (reinventing well-tested utilities — wasted effort and edge case bugs)**

The `@solid-primitives` collection has 60+ individually tree-shakeable packages for common patterns. Before writing a custom reactive wrapper for browser APIs, check if a battle-tested primitive already exists.

**Incorrect (hand-rolled media query hook):**

```tsx
function useMediaQuery(query: string) {
  const [matches, setMatches] = createSignal(false);

  onMount(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    // ❌ Missing cleanup, SSR handling, edge cases
    mql.addEventListener("change", (e) => setMatches(e.matches));
  });

  return matches;
}
```

**Correct (use the tested primitive):**

```tsx
import { createMediaQuery } from "@solid-primitives/media";

// ✅ Handles cleanup, SSR, and edge cases
const isDesktop = createMediaQuery("(min-width: 1024px)");

// In JSX:
<Show when={isDesktop()} fallback={<MobileNav />}>
  <DesktopNav />
</Show>
```

**Key packages to know:**

| Package | Use Case |
|---------|----------|
| `@solid-primitives/storage` | localStorage/sessionStorage with signals |
| `@solid-primitives/media` | Media queries, prefers-color-scheme |
| `@solid-primitives/scheduled` | Debounce, throttle, leading/trailing |
| `@solid-primitives/resize-observer` | Element resize tracking |
| `@solid-primitives/intersection-observer` | Viewport visibility |
| `@solid-primitives/event-listener` | Auto-cleaned event listeners |
| `@solid-primitives/clipboard` | Clipboard read/write |
| `@solid-primitives/timer` | Reactive setTimeout/setInterval |
| `@solid-primitives/keyboard` | Key combos, hotkeys |
| `@solid-primitives/geolocation` | Reactive GPS position |

**Install only what you need:**

```bash
bun add @solid-primitives/media @solid-primitives/scheduled
```

Reference: [Solid Primitives](https://github.com/solidjs-community/solid-primitives)

## Configure Tailwind CSS v4 with SolidJS Using Vite Plugin

**Impact: MEDIUM (broken styles or unnecessary PostCSS overhead)**

Tailwind CSS v4 replaces `tailwind.config.js` with a CSS-first `@theme` directive and uses a dedicated Vite plugin instead of PostCSS. In SolidJS projects, use `@tailwindcss/vite` (not the PostCSS plugin) and place it before `vite-plugin-solid` in the plugins array.

**Incorrect (v3 config approach or wrong plugin order):**

```typescript
// vite.config.ts — BAD: using PostCSS plugin instead of Vite plugin
import solidPlugin from "vite-plugin-solid"
export default defineConfig({
  plugins: [solidPlugin()],
  css: { postcss: { plugins: [require("tailwindcss")] } },
})
```

**Correct (v4 Vite plugin + CSS-first config):**

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite"
import solidPlugin from "vite-plugin-solid"
export default defineConfig({
  plugins: [tailwindcss(), solidPlugin()], // tailwindcss first
})
```

```css
/* src/index.css */
@import "tailwindcss";
@theme {
  --color-primary: hsl(220 90% 56%);
  --font-body: "Inter", sans-serif;
}
```

Key: `@import "tailwindcss"` replaces `@tailwind` directives. Theme values become CSS variables automatically.

Reference: [Tailwind CSS v4 SolidJS Installation](https://tailwindcss.com/docs/installation/framework-guides/solidjs)

## Use @solid-primitives/i18n with Lazy Dictionary Loading

**Impact: MEDIUM (large bundle from inlined translations or flash during locale switch)**

Use `@solid-primitives/i18n` with dynamically imported dictionaries per locale. Flatten dictionaries for efficient key lookup, load with `createResource`, and wrap locale switches in `useTransition` to avoid content flash.

**Incorrect (all locales bundled):**

```typescript
import en from "~/locales/en.json"
import es from "~/locales/es.json"
import fr from "~/locales/fr.json"
// All 3 dictionaries ship to every user
```

**Correct (lazy-loaded with transition):**

```typescript
import * as i18n from "@solid-primitives/i18n"

const fetchDictionary = async (locale: string) => {
  const dict = await import(`~/locales/${locale}.json`)
  return i18n.flatten(dict.default)
}

function createI18n(initialLocale = "en") {
  const [locale, setLocale] = createSignal(initialLocale)
  const [dict] = createResource(locale, fetchDictionary)
  const t = i18n.translator(dict)
  const [pending, start] = useTransition()
  const switchLocale = (next: string) => start(() => setLocale(next))
  return { t, locale, switchLocale, pending }
}
```

Reference: [@solid-primitives/i18n](https://primitives.solidjs.community/package/i18n/)

---

# 4. State Management

## Use Store Path Syntax for Surgical Nested Updates

**Impact: MEDIUM-HIGH (unnecessary re-renders from coarse updates)**

Store setters accept path arguments that update specific nested properties. Each path segment narrows the update scope so only subscribers of that exact path re-render.

**Incorrect (replacing entire objects):**

```typescript
const [state, setState] = createStore({
  users: [{ id: 1, name: "Alice", prefs: { theme: "dark" } }],
})
// BAD: replaces entire users array — all user components re-render
setState({ ...state, users: state.users.map(u => u.id === 1 ? { ...u, name: "Alicia" } : u) })
```

**Correct (path syntax for surgical updates):**

```typescript
setState("users", 0, "prefs", "theme", "light")           // by index path
setState("users", u => u.id === 2, "name", "Robert")       // by predicate
setState("count", c => c + 1)                               // functional update
setState("users", state.users.length, { id: 3, name: "Carol", prefs: { theme: "dark" } }) // append
```

Rule of thumb: path syntax for 1-2 property updates, `produce()` for 3+ or complex mutations.

Reference: [SolidJS Store API](https://docs.solidjs.com/concepts/stores)

---

# 6. SolidStart Patterns

## Use Vinxi useSession for Encrypted Cookie Sessions

**Impact: HIGH (insecure session handling or server-side leaks)**

Sessions must only be called inside `"use server"` functions. Always wrap in a typed helper for reuse.

**Incorrect (session outside server context):**

```typescript
// BAD: calling useSession in a component exposes the password
const session = useSession({ password: "short" })
```

**Correct (server-only typed helper):**

```typescript
import { useSession } from "vinxi/http"
type UserSession = { userId: string; role: "admin" | "user" }

function getSession() {
  "use server"
  return useSession<UserSession>({
    password: process.env.SESSION_SECRET!, // 32+ chars
    name: "app-session",
  })
}

async function login(userId: string) {
  "use server"
  const session = await getSession()
  await session.update({ userId, role: "user" })
}
```

Reference: [SolidStart Session Docs](https://docs.solidjs.com/solid-start/advanced/session)

## Share Validation Schema Between Client Form and Server Action

**Impact: HIGH (duplicated validation logic or missed server-side checks)**

Define a single Zod/Valibot schema in a shared module. Use it for client-side form validation and server-side action validation.

**Incorrect (duplicated or missing validation):**

```typescript
// BAD: client validates email differently than server (or server doesn't validate)
const valid = () => email().includes("@")
```

**Correct (shared schema):**

```typescript
// src/schemas/contact.ts
import { z } from "zod"
export const ContactSchema = z.object({
  email: z.string().email("Invalid email"),
  message: z.string().min(10).max(1000),
})

// Client: createForm({ validate: zodForm(ContactSchema) })
// Server action: ContactSchema.safeParse(Object.fromEntries(formData))
```

Reference: [Modular Forms SolidJS Guide](https://modularforms.dev/solid/guides/introduction)

## Use query() + preload for Route-Level Auth Guards

**Impact: HIGH (unauthorized access or flash of protected content)**

Use `query()` + `redirect()` in a route's `preload` function for route-specific auth requirements. Use `deferStream: true` to ensure redirects fire before streaming.

**Incorrect (auth check inside component):**

```typescript
function AdminDashboard() {
  const session = createAsync(() => getSession())
  createEffect(() => {
    if (session()?.role !== "admin") navigate("/unauthorized") // flash of content
  })
}
```

**Correct (query + preload):**

```typescript
export const requireAdmin = query(async () => {
  "use server"
  const user = await requireUser()
  if (user.role !== "admin") throw redirect("/unauthorized")
  return user
}, "requireAdmin")

export const route = { preload: () => requireAdmin() }
export default function AdminLayout(props: RouteSectionProps) {
  const user = createAsync(() => requireAdmin(), { deferStream: true })
  return <Show when={user()}>{props.children}</Show>
}
```

Reference: [SolidStart Auth Guide](https://docs.solidjs.com/solid-start/advanced/auth)

## Configure Nitro Presets for Target Deployment

**Impact: MEDIUM (failed deployments or missing platform features)**

Set `server.preset` in `app.config.ts` to match your deployment target.

```typescript
// app.config.ts — Cloudflare Pages
import { defineConfig } from "@solidjs/start/config"
export default defineConfig({
  server: {
    preset: "cloudflare_pages",
    compatibilityFlags: ["nodejs_compat_v2"],
  },
})

// Docker pattern for node-server preset
// CMD ["node", ".output/server/index.mjs"]
```

Common presets: `node-server`, `cloudflare_pages`, `vercel`, `netlify`, `deno`, `bun`, `static`

Reference: [Nitro Deploy Docs](https://nitro.build/deploy)
