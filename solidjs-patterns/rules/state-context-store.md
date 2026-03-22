---
title: Use Context with Store for App-Wide State
impact: HIGH
impactDescription: prevents prop drilling while maintaining fine-grained reactivity
tags: state, context, store, provider
---

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
