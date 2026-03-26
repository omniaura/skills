---
title: Use @solid-primitives/i18n with Lazy Dictionary Loading
impact: MEDIUM
impactDescription: "large bundle from inlined translations or flash during locale switch"
tags: i18n, internationalization, solid-primitives, lazy-loading
---

## Use @solid-primitives/i18n with Lazy Dictionary Loading

**Impact: MEDIUM (large bundle from inlined translations or flash during locale switch)**

Use `@solid-primitives/i18n` with dynamically imported dictionaries per locale. Flatten dictionaries for efficient key lookup, load them with `createResource`, and wrap locale switches in `useTransition` to avoid content flash during loading.

**Incorrect (all locales bundled or no loading state):**

```typescript
// BAD: importing all locales — every language ships to every user
import en from "~/locales/en.json"
import es from "~/locales/es.json"
import fr from "~/locales/fr.json"

const dicts = { en, es, fr }
// All 3 dictionaries in the main bundle regardless of user's locale
```

**Correct (lazy-loaded with transition):**

```typescript
import { createSignal, createResource, Suspense } from "solid-js"
import { useTransition } from "solid-js"
import * as i18n from "@solid-primitives/i18n"

// Only loads the dictionary for the active locale
const fetchDictionary = async (locale: string) => {
  const dict = await import(`~/locales/${locale}.json`)
  return i18n.flatten(dict.default) // flatten for dot-notation keys
}

type Locale = "en" | "es" | "fr"

function createI18n(initialLocale: Locale = "en") {
  const [locale, setLocale] = createSignal<Locale>(initialLocale)
  const [dict] = createResource(locale, fetchDictionary)
  const t = i18n.translator(dict)
  const [pending, start] = useTransition()

  // Wrap locale change in transition to keep old text visible while loading
  const switchLocale = (next: Locale) => start(() => setLocale(next))

  return { t, locale, switchLocale, pending }
}

// Context provider
const I18nContext = createContext<ReturnType<typeof createI18n>>()

function I18nProvider(props: ParentProps & { locale?: Locale }) {
  const i18n = createI18n(props.locale)

  return (
    <I18nContext.Provider value={i18n}>
      <Suspense fallback={<div>Loading...</div>}>
        <div style={{ opacity: i18n.pending() ? 0.6 : 1 }}>
          {props.children}
        </div>
      </Suspense>
    </I18nContext.Provider>
  )
}

function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}

// Usage in components
function Greeting() {
  const { t } = useI18n()
  return <h1>{t("greeting.hello")}</h1>
}

function LocaleSwitcher() {
  const { locale, switchLocale } = useI18n()
  return (
    <select value={locale()} onChange={e => switchLocale(e.target.value as Locale)}>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option>
    </select>
  )
}
```

Dictionary file structure:
```json
// src/locales/en.json
{
  "greeting": {
    "hello": "Hello",
    "welcome": "Welcome, {{name}}"
  },
  "nav": {
    "home": "Home",
    "settings": "Settings"
  }
}
```

Key rules:
- Use `i18n.flatten()` to enable dot-notation keys (`t("greeting.hello")`)
- Load dictionaries with dynamic `import()` — only the active locale is fetched
- Wrap `setLocale` in `useTransition` to prevent content flash
- Split large dictionaries by route/feature for even smaller chunks

Reference: [@solid-primitives/i18n](https://primitives.solidjs.community/package/i18n/)
