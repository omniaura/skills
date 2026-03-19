---
name: solidjs-patterns
description: SolidJS and SolidStart performance and correctness guidelines for AI agents. This skill should be used when writing, reviewing, or refactoring SolidJS/SolidStart code to ensure correct reactivity patterns and optimal performance. Triggers on tasks involving SolidJS components, signals, stores, Solid Query, SolidStart server functions, routing, or fine-grained reactivity.
license: MIT
metadata:
  author: omniaura
  version: "2.0.0"
---

# SolidJS Patterns and Best Practices

Comprehensive correctness and performance guide for SolidJS and SolidStart applications, maintained by OmniAura. Contains 50+ rules across 9 categories, prioritized by impact to guide automated refactoring and code generation. Built from production experience migrating from React to SolidJS.

## When to Apply

Reference these guidelines when:
- Writing new SolidJS components or SolidStart pages
- Migrating React code to SolidJS
- Implementing data fetching (Solid Query, createAsync, createResource)
- Working with SolidStart server functions ("use server")
- Reviewing code for reactivity correctness issues
- Optimizing bundle size or rendering performance
- Setting up state management (signals, stores, context)
- Writing tests for reactive code

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Reactivity Correctness | CRITICAL | `reactivity-` |
| 2 | Data Fetching & Server | CRITICAL | `data-` |
| 3 | Component Patterns | HIGH | `component-` |
| 4 | State Management | HIGH | `state-` |
| 5 | Rendering & Control Flow | MEDIUM-HIGH | `rendering-` |
| 6 | SolidStart Patterns | MEDIUM-HIGH | `start-` |
| 7 | Performance Optimization | MEDIUM | `perf-` |
| 8 | Testing | LOW-MEDIUM | `testing-` |
| 9 | External Interop | LOW | `interop-` |

## Quick Reference

### 1. Reactivity Correctness (CRITICAL)

- `reactivity-no-destructure-props` - Never destructure props — breaks reactivity
- `reactivity-no-helper-access` - Access signals/stores directly in JSX, not via helpers
- `reactivity-no-set-map-signal` - Use store instead of Set/Map with signal for collections
- `reactivity-no-rest-spread` - Use splitProps instead of rest spread
- `reactivity-signals-not-refs` - Use signals for timing-sensitive state, not plain refs
- `reactivity-no-direct-mutation` - Never mutate store values directly
- `reactivity-no-effect-order` - Don't assume effect execution order
- `reactivity-cleanup-effects` - Always clean up effects with onCleanup
- `reactivity-on-explicit-tracking` - Use on() to break circular dependencies

### 2. Data Fetching & Server (CRITICAL)

- `data-no-destructure-query` - Never destructure Solid Query results
- `data-parallel-queries` - Don't create query waterfalls
- `data-guard-suspense` - Guard .data access to prevent unwanted Suspense
- `data-include-all-query-keys` - Include all dependencies in query keys
- `data-query-options-function` - Wrap query options in arrow function

### 3. Component Patterns (HIGH)

- `component-no-early-return` - Don't return early before reactive primitives

### 4. State Management (HIGH)

- `state-signal-vs-store` - Choose signal vs store based on update granularity
- `state-context-pattern` - Use typed context with store for global state
- `state-reconcile-async` - Use reconcile for fine-grained async updates

### 5. Rendering & Control Flow (MEDIUM-HIGH)

- `rendering-use-for-not-map` - Use `<For>` instead of .map() for lists
- `rendering-use-show-not-ternary` - Use `<Show>` instead of JSX conditionals
- `rendering-suspense-inside-show` - Place Suspense inside conditionals (LazyShow pattern)

### 6. SolidStart Patterns (MEDIUM-HIGH)

- `start-use-server-validation` - Always validate "use server" function inputs
- `start-createasync-not-resource` - Use createAsync + query() for data loading
- `start-route-preloading` - Always define route preload functions

### 7. Performance Optimization (MEDIUM)

- `perf-lazy-load-heavy-components` - Lazy load heavy components
- `perf-create-selector` - Use createSelector for single-selection in large lists

### 8. Testing (LOW-MEDIUM)

- `testing-createroot` - Wrap reactive test code in createRoot

### 9. External Interop (LOW)

- `interop-from-browser-apis` - Use from() to bridge browser APIs into reactive signals

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/reactivity-no-destructure-props.md
rules/data-parallel-queries.md
rules/start-use-server-validation.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Impact rating and tags
- Additional context and references

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`

## Legacy Files

The following files contain additional detailed patterns and are being migrated into individual rules:
- `reactivity.md` - Reactivity fundamentals
- `explicit-tracking.md` - on() and untrack() patterns
- `state-patterns.md` - State management patterns
- `anti-patterns.md` - Common anti-patterns
- `advanced-primitives.md` - Secondary primitives
- `external-interop.md` - from() and observable() patterns
- `solid-query.md` - Solid Query patterns
- `performance.md` - Performance optimization
- `testing.md` - Testing patterns
