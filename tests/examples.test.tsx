import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal, flush, Loading } from "solid-js";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { deferredRead } from "../.generated/reactivity-1";
import { subscribeRoom } from "../.generated/reactivity-2";
import { Profile } from "../.generated/async-0";
import { createRenameModel } from "../.generated/async-1";
import { OptionalName } from "../.generated/query-0";
import { useAddItem } from "../.generated/query-2";
import { createTodos } from "../.generated/state-0";
import { ThemeButton, ThemeProvider } from "../.generated/state-1";
import { Button, Slot } from "../.generated/components-0";
import { Rows } from "../.generated/components-1";
import { NativeButton } from "../.generated/components-2";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.length = 0;
});
function client() {
  const result = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(result);
  return result;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("setter reads are stale until flush", () => {
  expect(deferredRead()).toEqual({ before: 0, after: 1 });
});

test("split effects return cleanup on replacement and disposal", () => {
  const [room, setRoom] = createSignal("a");
  const events: string[] = [];
  const { unmount } = render(() => {
    subscribeRoom(room, (id) => {
      events.push(`connect:${id}`);
      return () => {
        events.push(`disconnect:${id}`);
      };
    });
    return <span />;
  });
  flush();
  expect(events).toEqual(["connect:a"]);
  setRoom("b");
  flush();
  expect(events).toEqual(["connect:a", "disconnect:a", "connect:b"]);
  unmount();
  expect(events).toEqual(["connect:a", "disconnect:a", "connect:b", "disconnect:b"]);
});

test("async memo shows a local fallback and retains stale content on input changes", async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const [id, setId] = createSignal("a");
  render(() => (
    <>
      <nav>Shell</nav>
      <Profile id={id()} load={(key) => (key === "a" ? first.promise : second.promise)} />
    </>
  ));
  expect(screen.getByText("Shell")).toBeTruthy();
  expect(screen.getByText("Loading profile…")).toBeTruthy();
  first.resolve("Ada");
  await screen.findByText("Ada");
  setId("b");
  flush();
  await waitFor(() => expect(screen.getByText("Updating…")).toBeTruthy());
  expect(screen.getByText("Ada")).toBeTruthy();
  expect(screen.queryByText("Loading profile…")).toBeNull();
  second.resolve("Grace");
  await screen.findByText("Grace");
  expect(screen.queryByText("Ada")).toBeNull();
});

test("Errored handles rejected async memos without losing the shell", async () => {
  const request = deferred<string>();
  render(() => (
    <>
      <nav>Shell</nav>
      <Profile id="a" load={() => request.promise} />
    </>
  ));
  request.reject(new Error("offline"));
  await screen.findByRole("button", { name: "Retry: Error: offline" });
  expect(screen.getByText("Shell")).toBeTruthy();
});

test("optimistic action paints early, then reconciles authoritative data", async () => {
  const save = deferred<void>();
  let authoritative = "Ada";
  let model!: ReturnType<typeof createRenameModel>;
  render(() => {
    model = createRenameModel({
      read: async () => authoritative,
      save: async (next) => {
        await save.promise;
        authoritative = next;
      },
    });
    return (
      <Loading fallback="Loading">
        <p>{model.name()}</p>
      </Loading>
    );
  });
  await screen.findByText("Ada");
  const pending = model.rename("Grace");
  await screen.findByText("Grace");
  save.resolve();
  await pending;
  await waitFor(() => expect(screen.getByText("Grace")).toBeTruthy());
  expect(authoritative).toBe("Grace");
});

test("optimistic action restores authoritative data on failure", async () => {
  const save = deferred<void>();
  let model!: ReturnType<typeof createRenameModel>;
  render(() => {
    model = createRenameModel({ read: async () => "Ada", save: () => save.promise });
    return (
      <Loading fallback="Loading">
        <p>{model.name()}</p>
      </Loading>
    );
  });
  await screen.findByText("Ada");
  const pending = model.rename("Grace");
  const failure = expect(pending).rejects.toThrow("offline");
  await screen.findByText("Grace");
  save.reject(new Error("offline"));
  await failure;
  await screen.findByText("Ada");
});

test("disabled query status guard never suspends the shell", () => {
  const qc = client();
  render(() => (
    <QueryClientProvider client={qc}>
      <Loading fallback="Suspended">
        <OptionalName load={async (id) => id} />
      </Loading>
    </QueryClientProvider>
  ));
  expect(screen.getByText("Select a person")).toBeTruthy();
  expect(screen.queryByText("Suspended")).toBeNull();
});

test("cache optimism paints before mutation resolves; invalidation retains pending until fresh data", async () => {
  const qc = client();
  const save = deferred<{ id: string; text: string }>();
  const refetch = deferred<{ id: string; text: string }[]>();
  const initial = [{ id: "a", text: "Original" }];
  qc.setQueryData(["items"], initial);
  let model!: ReturnType<typeof useAddItem>;
  render(() => (
    <QueryClientProvider client={qc}>
      {(() => {
        model = useAddItem(() => save.promise);
        const query = useQuery(() => ({
          queryKey: ["items"],
          queryFn: () => refetch.promise,
          staleTime: Infinity,
        }));
        return (
          <Loading fallback="Loading">
            <p>{query.data.map((row) => row.text).join(",")}</p>
            <span>{model.mutation.isPending ? "Pending" : "Idle"}</span>
          </Loading>
        );
      })()}
    </QueryClientProvider>
  ));
  const item = { id: "b", text: "Optimistic" };
  const pending = model.add(item);
  await screen.findByText("Original,Optimistic");
  save.resolve(item);
  await waitFor(() => expect(qc.isFetching()).toBe(1));
  expect(screen.getByText("Original,Optimistic")).toBeTruthy();
  expect(screen.getByText("Pending")).toBeTruthy();
  expect(screen.queryByText("Loading")).toBeNull();
  refetch.resolve([...initial, { ...item, text: "Authoritative" }]);
  await pending;
  await screen.findByText("Original,Authoritative");
  await screen.findByText("Idle");
});

test("failed cache optimism rolls back from the closure snapshot", async () => {
  const qc = client();
  const save = deferred<{ id: string; text: string }>();
  const initial = [{ id: "a", text: "Original" }];
  qc.setQueryData(["items"], initial);
  let model!: ReturnType<typeof useAddItem>;
  render(() => (
    <QueryClientProvider client={qc}>
      {(() => {
        model = useAddItem(() => save.promise);
        const query = useQuery(() => ({
          queryKey: ["items"],
          queryFn: async () => initial,
          staleTime: Infinity,
        }));
        return (
          <Loading fallback="Loading">
            <p>{query.data.map((row) => row.text).join(",")}</p>
          </Loading>
        );
      })()}
    </QueryClientProvider>
  ));
  const pending = model.add({ id: "b", text: "Optimistic" });
  const failure = expect(pending).rejects.toThrow("offline");
  await screen.findByText("Original,Optimistic");
  save.reject(new Error("offline"));
  await failure;
  await screen.findByText("Original");
  expect(qc.getQueryData(["items"])).toEqual(initial);
});

test("draft reconciliation and projection update together", () => {
  const model = createTodos();
  model.replace([{ id: "1", text: "Task", done: false }]);
  flush();
  const row = model.state.todos[0];
  expect(model.summary).toMatchObject({ total: 1, done: 0 });
  model.replace([{ id: "1", text: "Updated", done: false }]);
  flush();
  expect(model.state.todos[0]).toBe(row);
  model.toggle("1");
  flush();
  expect(model.summary.done).toBe(1);
  expect(model.export().todos).toEqual([{ id: "1", text: "Updated", done: true }]);
});

test("context-as-provider shares live signal state", async () => {
  render(() => (
    <ThemeProvider>
      <ThemeButton />
    </ThemeProvider>
  ));
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  await screen.findByRole("button", { name: "Dark" });
});

test("merge/omit, class arrays and dynamic components compile and render", () => {
  const Content = (props: { label: string }) => <strong>{props.label}</strong>;
  render(() => (
    <>
      <Button class="extra">Send</Button>
      <Slot component={Content} label="Dynamic" />
    </>
  ));
  expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  expect(screen.getByRole("button").className).toBe("button extra");
  expect(screen.getByText("Dynamic")).toBeTruthy();
});

test("keyed rows preserve DOM identity across object replacement", () => {
  const [rows, setRows] = createSignal([{ id: "a", name: "Ada" }]);
  render(() => <Rows rows={rows()} selected="a" />);
  const row = screen.getByText("1: Ada");
  setRows([{ id: "a", name: "Grace" }]);
  flush();
  expect(screen.getByText("1: Grace")).toBe(row);
  expect(screen.getByRole("textbox").getAttribute("aria-label")).toBe("Slot 0");
});

test("ref factory cleans listeners after disposal, even on a retained DOM node", () => {
  let presses = 0;
  const { unmount } = render(() => (
    <NativeButton
      onPress={() => {
        presses++;
      }}
    />
  ));
  const button = screen.getByRole("button");
  fireEvent.click(button);
  expect(presses).toBe(1);
  unmount();
  fireEvent.click(button);
  expect(presses).toBe(1);
});
