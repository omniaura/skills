---
title: Co-locate test files alongside source files
impact: LOW-MEDIUM
impactDescription: Poor test discoverability and maintenance
tags: testing, organization, conventions
---

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
