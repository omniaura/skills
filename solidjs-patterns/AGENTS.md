# SolidJS & SolidStart Best Practices

> **Version:** 1.0.0
> **Author:** OmniAura
> **Date:** 2026-03-19
> **SolidJS:** 1.9.x | **SolidStart:** 1.x | **Solid Query:** 5.x

This document is intended for AI agents and LLMs assisting with SolidJS and SolidStart codebases. It compiles all known best practices, anti-patterns, and correctness rules into a single reference. Every rule includes incorrect and correct code examples with impact ratings.

## Abstract

SolidJS uses fine-grained reactivity where components run once (not per-render like React). This fundamental difference means destructuring breaks reactivity, signals must be read inside tracking scopes, and control flow components are performance-critical rather than syntactic sugar. These rules prevent the most common and costly mistakes when writing or migrating SolidJS code.

---

## Table of Contents

1. [Reactivity Correctness](#1-reactivity-correctness) -- CRITICAL
2. [Data Fetching & Server](#2-data-fetching--server) -- CRITICAL
3. [Component Patterns](#3-component-patterns) -- HIGH
4. [State Management](#4-state-management) -- HIGH
5. [Rendering & Control Flow](#5-rendering--control-flow) -- MEDIUM-HIGH
6. [SolidStart Patterns](#6-solidstart-patterns) -- MEDIUM-HIGH
7. [Performance Optimization](#7-performance-optimization) -- MEDIUM
8. [Testing](#8-testing) -- LOW-MEDIUM
9. [External Interop](#9-external-interop) -- LOW

---

## 1. Reactivity Correctness

**Impact: CRITICAL**

SolidJS's fine-grained reactivity is its core advantage but also the #1 source of bugs. Signals must be read inside reactive contexts, stores must not be destructured, and tracking scopes must be understood. Getting reactivity wrong silently breaks your UI.

---

### Never Destructure Props

**Impact: CRITICAL (silent reactivity loss -- UI stops updating)**

SolidJS components run once, not per-render. Destructuring props captures values at creation time -- they never update.

**Incorrect (destructured props lose reactivity):**

```typescript
function Badge({ count, color }: BadgeProps) {
  return <span style={{ color }}>{count}</span>
}
// count and color are captured once -- never update when parent passes new values
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

---

### Access Signals/Stores Directly in JSX

**Impact: CRITICAL (silent tracking loss -- UI stops reacting to changes)**

Signal and store access must happen inside the reactive context (JSX, createEffect, createMemo), not inside helper functions called from JSX. The reactive system tracks where signals are read -- if they're read inside a plain function, the tracking happens there, not in JSX.

**Incorrect (access happens in helper, outside reactive JSX context):**

```typescript
const [expanded, setExpanded] = createStore<boolean[]>([])

const isExpanded = (index: number) => expanded[index] === true

// In JSX -- this WON'T update when expanded changes!
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
// Bad: Access in helper
const getCount = () => count()
<div>{getCount()}</div>  // Won't update!

// Good: Access directly in JSX
<div>{count()}</div>
```

Reference: [SolidJS Reactivity](https://docs.solidjs.com/concepts/intro-to-reactivity)

---

### Use Store Instead of Set/Map with Signal

**Impact: CRITICAL (O(n) updates instead of O(1) -- all subscribers re-run)**

`Set` and `Map` inside `createSignal` don't provide per-item reactivity. Changing any item forces ALL subscribers to update because the signal's identity changes.

**Incorrect (Set with signal -- all subscribers update on any change):**

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

**Correct (Store with record -- only affected subscribers update):**

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

---

### Use splitProps Instead of Rest Spread

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

---

### Use Signals for Timing-Sensitive State, Not Refs

**Impact: CRITICAL (closures capture stale ref values -- race conditions and bugs)**

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
    if (!isPaginating) {  // Reads OLD value from closure
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
    if (!isPaginating()) {  // Reads CURRENT value
      scrollToBottom()
    }
  }, 100)
  return () => clearTimeout(timeout)
})
```

**Key insight**: Signals are *read* when called. Refs are *captured* when closures are created.

Reference: [SolidJS Signals](https://docs.solidjs.com/concepts/signals)

---

### Never Mutate Store Values Directly

**Impact: CRITICAL (mutations silently ignored -- UI doesn't update)**

Store proxies track reads and writes through the setter function. Direct mutation bypasses the proxy and triggers nothing.

**Incorrect (direct mutation -- no update triggered):**

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

---

### Don't Assume Effect Execution Order

**Impact: HIGH (intermittent bugs from effects running in unexpected order)**

Effects run when their dependencies change, not in source code order. Two effects with different dependencies may execute in any order.

**Incorrect (assuming first effect runs before second):**

```typescript
createEffect(() => {
  wasPaginatingRef.current = props.isFetchingNextPage
})

createEffect(() => {
  if (!wasPaginatingRef.current) {
    scrollToBottom()  // May run BEFORE the first effect!
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

---

### Always Clean Up Effects with onCleanup

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

---

### Use on() to Break Circular Dependencies

**Impact: HIGH (infinite effect loops from reading and writing the same signal)**

When an effect reads a signal it also writes, it creates a circular dependency. Use `on()` to explicitly declare which signals trigger the effect -- the callback body runs in an untracked context.

**Incorrect (circular dependency -- effect triggers itself):**

```typescript
createEffect(() => {
  const status = streamStatusQuery.data  // tracked
  if (!status) return
  if (status.isStreaming && !isWaitingForResponse()) {  // tracked!
    setIsWaitingForResponse(true)  // triggers re-run!
  }
})
```

**Correct (on() -- only track query data, not the signal being written):**

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

---

## 2. Data Fetching & Server

**Impact: CRITICAL**

Correct data fetching patterns (createAsync, query, createResource, Solid Query) prevent waterfalls, avoid Suspense traps, and keep UIs responsive. SolidStart server functions ("use server") require input validation at the boundary.

---

### Never Destructure Solid Query Results

**Impact: CRITICAL (query state frozen -- loading/error/data never update)**

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

---

### Don't Create Query Waterfalls

**Impact: CRITICAL (2-5x slower load times from sequential fetching)**

Independent queries should fetch in parallel. Don't gate one query on another unless there's a true data dependency.

**Incorrect (unnecessary waterfall -- second query waits for first):**

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
    // No enabled -- fetches immediately in parallel
  }))
}
```

Only use `enabled` when there's a genuine data dependency (e.g., fetch user's posts after user ID is known).

Reference: [TanStack Query Dependent Queries](https://tanstack.com/query/latest/docs/framework/solid/guides/dependent-queries)

---

### Guard .data Access to Prevent Unwanted Suspense

**Impact: CRITICAL (entire UI replaced by skeleton when any query loads)**

In Solid Query, queries suspend by DEFAULT inside Suspense boundaries. Accessing `query.data` while loading triggers Suspense -- the nearest boundary shows its fallback, potentially replacing your entire UI.

**Incorrect (accessing .data triggers Suspense -- whole app shows skeleton):**

```typescript
const showSalesPitch = createMemo(
  () => paymentError() || (user.data?.balance ?? 1_000_000_000) <= 0
)
// When user query is loading, this accesses user.data -> SUSPENDS -> whole app skeleton!
```

**Correct (guard .data access with .isLoading check):**

```typescript
const showSalesPitch = createMemo(
  () => paymentError() ||
    (user.isLoading ? false : (user.data?.balance ?? 1_000_000_000) <= 0)
)
// When loading, returns safe default without accessing .data -> NO SUSPENSION
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

---

### Include All Dependencies in Query Keys

**Impact: HIGH (stale data served from wrong cache entry)**

Query keys determine cache identity. Missing a dependency means different requests share the same cache, returning stale or wrong data.

**Incorrect (query key missing userId -- always hits same cache):**

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

---

### Wrap Query Options in Arrow Function

**Impact: HIGH (reactive query keys don't update -- queries never refetch)**

In Solid Query, options must be wrapped in a function `() => ({...})` to enable reactive query keys. This is different from React Query's plain object.

**Incorrect (plain object -- query keys don't react to signal changes):**

```typescript
// React Query pattern -- WRONG in Solid Query
const query = createQuery({
  queryKey: ["user", userId()],
  queryFn: () => fetchUser(userId()),
})
```

**Correct (arrow function wrapper enables reactivity):**

```typescript
const query = createQuery(() => ({
  queryKey: ["user", userId()],  // userId is a signal -- re-fetches when it changes
  queryFn: () => fetchUser(userId()),
}))
```

This applies to `createQuery`, `createMutation`, and `createInfiniteQuery`.

Reference: [TanStack Solid Query Overview](https://tanstack.com/query/latest/docs/solid/overview)

---

## 3. Component Patterns

**Impact: HIGH**

Props handling (splitProps, mergeProps), children patterns, and component composition are unique in SolidJS. Destructuring breaks reactivity, rest spread loses tracking, and component functions run once (not per-render like React).

---

### Don't Return Early Before Reactive Primitives

**Impact: HIGH (hooks run inconsistently -- effects and signals may not initialize)**

SolidJS components run once. Early returns before `createSignal`/`createEffect` mean those primitives never execute. Unlike React, there's no "rules of hooks" error -- it silently fails.

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

---

## 4. State Management

**Impact: HIGH**

Choosing the right primitive (signal vs store vs context) determines update granularity. Stores provide per-property reactivity for objects/arrays. Incorrect choices cause either over-updating (signal for collections) or unnecessary complexity (store for primitives).

---

### Choose Signal vs Store Based on Update Granularity

**Impact: HIGH (over-updating or unnecessary complexity)**

Signals replace the entire value on update -- all subscribers re-run. Stores provide per-property reactivity. Match the primitive to your update pattern.

**Use `createSignal` when:**

```typescript
// Primitive values
const [isOpen, setIsOpen] = createSignal(false)

// Objects replaced entirely
const [position, setPosition] = createSignal({ x: 0, y: 0 })
setPosition({ x: 10, y: 20 })  // Full replacement

// Simple derived values
const [count, setCount] = createSignal(0)
```

**Use `createStore` when:**

```typescript
// Per-item updates in collections
const [expanded, setExpanded] = createStore<boolean[]>([])
setExpanded(2, true)  // Only subscribers of index 2 update

// Complex nested state with partial updates
const [state, setState] = createStore({
  users: [],
  settings: { theme: "dark", lang: "en" }
})
setState("settings", "theme", "light")  // Only theme subscribers update

// Form state with many fields
const [form, setForm] = createStore({ name: "", email: "", message: "" })
setForm("name", "Alice")  // Only name field subscribers update
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

---

### Use Typed Context with Store for Global State

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

---

### Use reconcile for Fine-Grained Async Updates

**Impact: MEDIUM-HIGH (entire list re-renders instead of minimal diff on refetch)**

When you refetch data from the server, replacing a store entirely triggers all subscribers. Use `reconcile` to diff the new data against the existing store -- only changed properties trigger updates.

**Incorrect (full replacement -- all subscribers update):**

```typescript
const [items, setItems] = createStore<Item[]>([])

createEffect(async () => {
  const data = await fetchItems()
  setItems(data)  // Every subscriber re-runs even if most items unchanged
})
```

**Correct (reconcile -- only changed items trigger updates):**

```typescript
import { createStore, reconcile } from "solid-js/store"

const [items, setItems] = createStore<Item[]>([])

createEffect(async () => {
  const data = await fetchItems()
  setItems(reconcile(data))  // Only changed items trigger an update
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

---

## 5. Rendering & Control Flow

**Impact: MEDIUM-HIGH**

SolidJS control flow components (Show, For, Switch, Index, ErrorBoundary) are not syntactic sugar -- they're performance-critical. Using JSX conditionals or .map() instead causes full remounts and lost state.

---

### Use `<For>` Instead of .map() for Lists

**Impact: CRITICAL (100-1000x more DOM operations -- full remount on every update)**

`.map()` works but recreates every DOM node when the list changes. `<For>` diffs by reference and only mounts new items. For lists that grow incrementally (chat, feeds), `.map()` causes catastrophic remounts.

**Incorrect (.map() -- ALL items remount on every change):**

```typescript
{messages().map(message => (
  <ChatMessage key={message.id} data={message} />
)).reverse()}
// Symptoms: avatar images flash/reload, scroll position jumps,
// thousands of mounts for what should be incremental updates
```

**Correct (`<For>` -- only new items mount):**

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

---

### Use `<Show>` Instead of JSX Conditionals

**Impact: HIGH (component state lost, animations restart on condition toggle)**

JSX ternary (`? :`) and AND (`&&`) patterns destroy and recreate components on every condition change. `<Show>` preserves component instances and integrates with SolidJS signals for optimal updates.

**Incorrect (JSX conditionals -- component destroyed and recreated):**

```typescript
{isLoading() && <Spinner />}

{isLoggedIn() ? <Dashboard /> : <LoginForm />}
// Component state lost, animations restart, expensive effects re-run
```

**Correct (`<Show>` -- component instances preserved):**

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

---

### Place Suspense Inside Conditionals (LazyShow Pattern)

**Impact: MEDIUM-HIGH (layout flicker when toggling modals/conditional content)**

Wrapping `<Show>` inside `<Suspense>` causes the Suspense fallback to flash every time the condition changes. Placing Suspense inside the Show (LazyShow pattern) avoids this.

**Incorrect (Suspense around Show -- flicker on toggle):**

```typescript
<Suspense fallback={<Loading />}>
  <Show when={isModalOpen()}>
    <HeavyModal />
  </Show>
</Suspense>
```

**Correct (LazyShow pattern -- Suspense inside Show):**

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

---

## 6. SolidStart Patterns

**Impact: MEDIUM-HIGH**

SolidStart-specific patterns for routing, server functions, middleware, SSR, and deployment. Includes createAsync + query patterns, "use server" validation, and file-based routing best practices.

---

### Always Validate "use server" Function Inputs

**Impact: CRITICAL (security vulnerability -- client can send any data across RPC boundary)**

`"use server"` functions are called via RPC from the client. TypeScript types don't exist at runtime -- the client can send anything. Always validate inputs server-side.

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

---

### Use createAsync + query() for Data Loading in SolidStart

**Impact: HIGH (missing cache dedup, improper invalidation, waterfall fetches)**

SolidStart's modern data fetching pattern uses `query()` for cached server functions and `createAsync` for non-blocking consumption. `createResource` is the lower-level primitive -- it doesn't integrate with SolidStart's cache or router preloading.

**Incorrect (createResource -- no cache dedup or preloading):**

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

**Correct (query + createAsync -- cached, deduped, preloadable):**

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
- Automatic deduplication -- 2 identical requests never fly out
- Route preloading -- data fetches start during navigation, not after render
- Cache invalidation via `revalidate()`
- Non-blocking -- renders using Suspense boundaries, no waterfalls

Reference: [SolidStart Data Loading](https://docs.solidjs.com/solid-start/building-your-application/data-loading)

---

### Always Define Route Preload Functions

**Impact: HIGH (data fetches delayed until after navigation completes and component renders)**

Without a `load` function, data fetching only starts when the route component renders. With preloading, data fetching starts during navigation -- the page appears ready faster.

**Incorrect (no preload -- fetch starts after render):**

```typescript
// routes/users/[id].tsx
function UserPage() {
  const params = useParams()
  const user = createAsync(() => getUser(params.id))
  // Fetch starts AFTER route component renders
  return <Suspense><Profile user={user()} /></Suspense>
}
```

**Correct (route preload -- fetch starts during navigation):**

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

---

## 7. Performance Optimization

**Impact: MEDIUM**

Code splitting, lazy loading, bundle optimization, memoization, and Suspense boundary placement. SolidJS is fast by default, but lazy loading and strategic Suspense boundaries still matter for large apps.

---

### Lazy Load Heavy Components

**Impact: MEDIUM (30-60% initial bundle reduction for modal-heavy apps)**

Use `lazy()` for components that aren't visible on initial render: modals, settings panels, charts, editors. Don't lazy load small components -- the overhead isn't worth it.

**When to lazy load:**

```typescript
import { lazy } from "solid-js"

// DO lazy load: modals, charts, editors, large forms
const SettingsModal = lazy(() => import("./modals/SettingsModal"))
const MarkdownEditor = lazy(() => import("./components/MarkdownEditor"))
const DataVisualization = lazy(() => import("./components/DataVisualization"))

// DON'T lazy load: small components, frequently-used UI elements
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

---

### Use createSelector for Single-Selection in Large Lists

**Impact: MEDIUM (O(1) updates instead of O(n) -- only 2 items update on selection change)**

Without `createSelector`, every item in a list checks `selectedId() === item.id` on selection change -- all re-run. With it, only the previously-selected and newly-selected items update.

**Incorrect (O(n) -- all items re-evaluate on selection change):**

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

**Correct (O(1) -- only 2 items update):**

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

---

## 8. Testing

**Impact: LOW-MEDIUM**

Testing reactive code requires understanding createRoot, renderHook, and how effects run synchronously in test contexts. Solid Query mocking and async testing have unique patterns.

---

### Wrap Reactive Test Code in createRoot

**Impact: LOW-MEDIUM (leaked reactive contexts, orphaned effects in tests)**

Testing reactive primitives (signals, stores, effects) requires a reactive owner context. Use `createRoot` to provide one, and always call `dispose` for cleanup.

**Correct pattern:**

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

---

## 9. External Interop

**Impact: LOW**

Bridging SolidJS reactivity with external APIs (browser observers, RxJS, WebSockets) via `from` and `observable`. Advanced patterns for when you need to consume or expose signals to non-Solid code.

---

### Use from() to Bridge Browser APIs into Reactive Signals

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

// Usage -- reactive!
const isWidescreen = useMediaQuery("(min-width: 1280px)")
```

**Key rules for `from`:**
1. Always return a cleanup function (even if empty)
2. Return type is `T | undefined` until first `set()` call
3. Check `typeof window` for SSR safety

Reference: [SolidJS from()](https://docs.solidjs.com/reference/reactive-utilities/from)
