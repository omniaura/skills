---
name: solidjs-patterns
description: SolidJS reactivity patterns, state management, and common pitfalls. Covers createSignal vs createStore, fine-grained reactivity, collapsible UI components, and anti-patterns to avoid.
---

# SolidJS Patterns and Best Practices

This skill provides guidance on SolidJS-specific patterns used in the Ditto frontend. SolidJS has a unique reactivity model that differs from React, and understanding these patterns is essential for building performant, bug-free UIs.

## Quick Navigation

- **[Reactivity Fundamentals](reactivity.md)** - Understanding signals, stores, and reactive contexts
- **[Explicit Dependency Tracking](explicit-tracking.md)** - Using `on()` to control what triggers effects (like React's useEffect deps)
- **[State Management Patterns](state-patterns.md)** - Choosing the right state primitive for your use case
- **[Common Anti-Patterns](anti-patterns.md)** - Patterns that look correct but break reactivity
- **[Advanced Primitives](advanced-primitives.md)** - Secondary primitives: createSelector, createDeferred, useTransition, etc.
- **[External Interop](external-interop.md)** - Using `from` and `observable` for browser APIs and RxJS
- **[Performance Patterns](performance.md)** - Code splitting, lazy loading, and bundle optimization
- **[Testing SolidJS](testing.md)** - Unit testing reactive code with vitest

## Key Principle: Fine-Grained Reactivity

SolidJS uses **fine-grained reactivity** - only the exact DOM nodes that depend on changed data will update. This is fundamentally different from React's virtual DOM diffing.

### Why This Matters

```typescript
// In React: Changing `items[2]` re-renders the entire list component
// In SolidJS: Only the DOM node for items[2] updates

// BUT: You must use the right primitives to get this behavior
```

## Quick Reference: When to Use What

| Use Case | Primitive | Example |
|----------|-----------|---------|
| Single value | `createSignal<T>` | `createSignal<boolean>(false)` |
| Object with few properties | `createSignal<T>` | `createSignal({ x: 0, y: 0 })` |
| List where items change individually | `createStore<T[]>` | `createStore<boolean[]>([])` |
| Complex nested state | `createStore<T>` | `createStore({ users: [], settings: {} })` |
| Derived/computed value | `createMemo` | `createMemo(() => items().length)` |
| Large list with single selection | `createSelector` | `createSelector(selectedId)` |
| Timing-sensitive blocking flags | `createSignal` | Never use plain refs for this! |
| Deferred expensive computation | `createDeferred` | `createDeferred(searchTerm)` |
| External subscriptions (browser APIs) | `from` | `from((set) => { ... return cleanup })` |

## Common Gotchas

1. **Don't destructure props** - Breaks reactivity
2. **Don't access signals outside JSX** through helper functions - Breaks tracking
3. **Don't use Set/Map with createSignal** for per-item reactivity - Use createStore instead
4. **Do access store properties directly in JSX** - Creates proper subscriptions
5. **Don't use plain refs for timing-sensitive state** - Refs are captured in closures, signals are read at execution time
6. **Don't assume effect order** - Effects run in dependency order, not definition order

## Related Reports

- [2025-01-14 - SendMessage Streaming State Bug Audit](../../../docs/audits/2025-01-14-sendmessage-streaming-state-bug/00-summary.md) - Case study: `on()` fixing circular dependency between query and signal
- [2026-01-11 - SolidJS Collapsible Cards Reactivity Fix](../../../docs/reports/2026-01-11-solidjs-collapsible-cards-reactivity.md) - Detailed case study of debugging reactivity issues
- [2026-01-11 - Skeleton/Suspense/Code Splitting Architecture](../../../docs/reports/2026-01-11-skeleton-suspense-code-splitting-architecture.md) - LazyShow pattern, skeleton components
- [2026-01-10 - SolidJS Code Splitting Implementation](../../../docs/reports/2026-01-10-solidjs-code-splitting-implementation.md) - Route-level and component splitting strategies
- [2026-01-09 - SolidJS vs React Performance Comparison](../../../docs/reports/2026-01-09-solidjs-react-performance-comparison.md) - Performance metrics and optimization
- [2026-01-07 - SolidJS Migration Testing](../../../docs/reports/2026-01-07-solidjs-migration-testing.md) - Testing patterns during React→SolidJS migration
