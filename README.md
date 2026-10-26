# Omni Aura Agent Skills

Reusable skills for AI coding agents, built from production experience at [Ditto](https://heyditto.ai?utm_source=github&utm_medium=skills-repo&utm_campaign=solidjs-patterns).

## solidjs-patterns v3

**v3 requires Solid 2.0; use v2 for Solid 1.x.** This skill targets Solid `2.0.0-rc.18` and TanStack Solid Query `6.0.0-rc.5`. It supports SPAs; adopting SSR or SolidStart is not required.

Six focused references replace 65 Solid 1 rules: reactivity/lifecycle, async/actions, Query v6, stores/context, components/DOM, and testing. Read [SKILL.md](solidjs-patterns/SKILL.md) as the entry point or [AGENTS.md](solidjs-patterns/AGENTS.md) for the generated full reference.

### Install

```sh
npx skills add omniaura/skills --skill solidjs-patterns
```

Solid 1 projects should pin the previous skill revision, not install main:

```sh
npx skills add omniaura/skills@76dfb33 --skill solidjs-patterns
```

Or copy `solidjs-patterns/` from the appropriate revision into your agent's skills directory. Pin a reviewed revision in automated installs while Solid 2 is in RC.

### What changed

- Split effects with returned cleanup; deferred setters and intentional `flush` boundaries.
- Async memos with `Loading`/`Errored`/`Reveal`; optimistic actions without resource boilerplate.
- Draft-first stores, projections, context-as-provider, keyed lists, class arrays, and owned ref factories.
- Query v6 suspending reads, disabled-query status guards, promise mutations, atomic invalidation, and cache optimism that actually paints.
- Removed obsolete Solid 1 workarounds and unverified SolidStart recipes. Keep Query when shared cache, persistence, pagination, or devtools justify it; native async rendering alone does not replace them.

### Develop and validate

```sh
bun install --frozen-lockfile
bun run build        # rules -> AGENTS.md + standalone .generated/*.tsx examples
bun run build:check  # reject generated reference drift
bun run typecheck    # every TS/TSX example plus harness
bun run test         # real Solid 2 JSX compiler + Vitest/jsdom regression tests
bun run format:check
```

Edit `rules/*.md`; never edit `AGENTS.md` directly. `scripts/build.ts` owns the explicit section order and extracts standalone typed examples. Tests import those exact snippets, not hand-maintained copies. Runtime probes cover lifecycle cleanup, async stale-content retention, deferred writes, stores, Query status guards, optimistic mutations, and ref disposal. Documentation is validated in jsdom, not claimed as a browser-tested application.

## Links

- [Solid 2 documentation](https://v2.solidjs.com)
- [Solid 2 migration guide](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/MIGRATION.md)
- [Solid Query documentation](https://tanstack.com/query/latest/docs/framework/solid/overview) — check installed RC types for version-specific API changes.
