import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { COMMANDS, type Mode } from "@/lib/terminal/catalog";
import { parseLine, type CommandResult } from "@/lib/terminal/commands";
import { pluginById, pluginBySpec } from "@/lib/terminal/catalog";
import { completeReply, imagineStill, shipGame } from "@/lib/terminal/reply";
import { active, flagsFor, freshId, loadSaved, saveDeck, useDeck } from "@/lib/terminal/store";
import type { Beat, Block, Session } from "@/lib/terminal/types";
import { Panel } from "@/components/terminal/Panel";
import { ImagineTab } from "@/components/terminal/ImagineTab";

const STARTERS = [
  { n: "01", text: "Install superpowers and tell me what changes" },
  { n: "02", text: "Plan a fix for the auth flicker" },
  { n: "03", text: "Why does a failing test come first?" },
];

export function TerminalApp() {
  const sessions = useDeck((state) => state.sessions);
  const activeId = useDeck((state) => state.activeId);
  const model = useDeck((state) => state.model);
  const rail = useDeck((state) => state.rail);
  const busy = useDeck((state) => state.busy);
  const drawer = useDeck((state) => state.drawer);
  const session = sessions.find((item) => item.id === activeId) ?? sessions[0];
  const [tab, setTab] = useState<"deck" | "imagine">("deck");
  const [draft, setDraft] = useState("");
  const [palette, setPalette] = useState(0);
  const [hist, setHist] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const box = useRef<HTMLTextAreaElement>(null);
  const run = useRef(0);
  const cont = useRef<{ sessionId: string; beats: Beat[]; token: number; permitId: string } | null>(
    null,
  );

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      if (!saved.sessions.some((item) => item.id === saved.activeId) && saved.sessions[0]) {
        saved.activeId = saved.sessions[0].id;
      }
      useDeck.getState().hydrate(saved);
    } else {
      useDeck.getState().markHydrated();
    }
  }, []);

  useEffect(() => {
    return useDeck.subscribe((state, prev) => {
      if (!state.hydrated) return;
      if (
        state.sessions !== prev.sessions ||
        state.activeId !== prev.activeId ||
        state.model !== prev.model ||
        state.plugins !== prev.plugins ||
        state.stills !== prev.stills
      ) {
        saveDeck(state);
      }
    });
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const deck = useDeck.getState();
      if (deck.drawer) deck.setDrawer(null);
      else if (deck.rail) deck.setRail(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      run.current += 1;
    };
  }, []);

  useEffect(() => {
    const node = scroller.current;
    if (!node || !stick.current) return;
    node.scrollTop = node.scrollHeight;
  }, [session?.blocks, busy]);

  const token = draft.startsWith("/") ? (draft.slice(1).split(" ")[0] ?? "") : "";
  const showPalette = draft.startsWith("/") && !draft.includes(" ");
  const matches = useMemo(
    () => COMMANDS.filter((command) => command.name.startsWith(token.toLowerCase())),
    [token],
  );

  useEffect(() => {
    setPalette(0);
  }, [token]);

  if (!session) return null;

  async function play(sessionId: string, beats: Beat[]) {
    const tokenId = ++run.current;
    useDeck.getState().setBusy(true);
    await step(sessionId, beats, tokenId);
  }

  async function step(sessionId: string, beats: Beat[], tokenId: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      for (const beat of beats) {
        if (run.current !== tokenId) return;
        if (beat.t === "tool") {
          const id = freshId();
          useDeck.getState().addBlock(sessionId, {
            id,
            kind: "tool",
            name: beat.name,
            detail: beat.detail,
            state: "run",
          });
          await wait(reduced ? 0 : 420);
          if (run.current !== tokenId) return;
          useDeck.getState().patchBlock(sessionId, id, { state: "ok" });
        } else if (beat.t === "say") {
          const id = freshId();
          useDeck.getState().addBlock(sessionId, { id, kind: "agent", text: "" });
          if (reduced) {
            useDeck.getState().patchBlock(sessionId, id, { text: beat.text });
          } else {
            const parts = beat.text.split(/(\s+)/);
            let acc = "";
            for (const part of parts) {
              if (run.current !== tokenId) return;
              acc += part;
              useDeck.getState().patchBlock(sessionId, id, { text: acc });
              await wait(16);
            }
          }
        } else if (beat.t === "plan") {
          useDeck.getState().setPlan(sessionId, beat.steps);
        } else if (beat.t === "permit") {
          const permitId = freshId();
          useDeck.getState().addBlock(sessionId, {
            id: permitId,
            kind: "permit",
            title: beat.title,
            detail: beat.detail,
          });
          cont.current = { sessionId, beats: beat.then, token: tokenId, permitId };
          return;
        }
      }
    } finally {
      if (run.current === tokenId && !cont.current) useDeck.getState().setBusy(false);
    }
  }

  function decide(allow: boolean) {
    const pending = cont.current;
    if (!pending) return;
    cont.current = null;
    useDeck.getState().patchBlock(pending.sessionId, pending.permitId, {
      decision: allow ? "allow" : "deny",
    });
    if (!allow) {
      useDeck.getState().note(pending.sessionId, "Denied. Nothing ran.");
      useDeck.getState().setBusy(false);
      return;
    }
    void step(pending.sessionId, pending.beats, pending.token);
  }

  function apply(sessionId: string, command: CommandResult) {
    const deck = useDeck.getState();
    if (command.type === "drawer") deck.setDrawer(command.drawer);
    else if (command.type === "sessions") deck.setRail(true);
    else if (command.type === "new") deck.newSession();
    else if (command.type === "fork") {
      deck.forkSession();
      deck.note(useDeck.getState().activeId, "Forked. This copy keeps the transcript.");
    } else if (command.type === "compact") deck.compact();
    else if (command.type === "context") {
      const current = active(useDeck.getState());
      deck.note(
        sessionId,
        `Context ${contextOf(current)}% of a toy window · ${useDeck.getState().model} · mode ${current.mode}.`,
      );
    } else if (command.type === "rename") {
      deck.renameSession(command.title);
      deck.note(sessionId, `Renamed to ${command.title}.`);
    } else if (command.type === "cd") {
      deck.setCwd(command.cwd);
      deck.note(sessionId, `cwd → ~/${command.cwd}`);
    } else if (command.type === "install") {
      const plugin = pluginBySpec(command.spec);
      if (plugin) void install(plugin.id, sessionId);
    } else if (command.type === "imagine") {
      void draw(sessionId, command.prompt, command.aspect);
    } else deck.note(sessionId, command.text);
  }

  async function draw(sessionId: string, prompt: string, aspect?: string) {
    const tokenId = ++run.current;
    const deck = useDeck.getState();
    deck.setBusy(true);
    const toolId = freshId();
    const detail = aspect ? `${aspect} · ${prompt}` : prompt;
    deck.addBlock(sessionId, {
      id: toolId,
      kind: "tool",
      name: "imagine",
      detail: detail.length > 56 ? `${detail.slice(0, 56)}…` : detail,
      state: "run",
    });
    try {
      const result = await imagineStill({ data: { prompt, aspect } });
      if (run.current !== tokenId) return;
      useDeck.getState().patchBlock(sessionId, toolId, { state: "ok" });
      useDeck.getState().addBlock(sessionId, {
        id: freshId(),
        kind: "image",
        prompt,
        url: result.url,
      });
      useDeck.getState().addStill({
        id: freshId(),
        prompt,
        url: result.url,
        aspect: aspect ?? "1:1",
      });
    } catch (error) {
      if (run.current !== tokenId) return;
      useDeck.getState().patchBlock(sessionId, toolId, { state: "ok" });
      const message = error instanceof Error ? error.message : "Imagine failed.";
      useDeck.getState().note(sessionId, message);
    } finally {
      if (run.current === tokenId) useDeck.getState().setBusy(false);
    }
  }

  async function install(id: string, sessionId: string) {
    const deck = useDeck.getState();
    if (deck.busy) return;
    const plugin = pluginById(id);
    if (!plugin) return;
    if (flagsFor(deck.plugins, id).installed) {
      deck.note(sessionId, `${plugin.spec} is already on this deck.`);
      deck.setDrawer("plugins");
      return;
    }
    deck.setPendingInstall(id);
    deck.setBusy(true);
    deck.setDrawer("marketplace");
    deck.note(sessionId, `Fetching ${plugin.spec}…`);
    await wait(700);
    useDeck.getState().installPlugin(id);
    useDeck.getState().note(
      sessionId,
      `Installed ${plugin.spec} --trust. Open /skills. Hooks stay inside this deck.`,
    );
    useDeck.getState().setBusy(false);
  }

  function submit(text: string) {
    const deck = useDeck.getState();
    if (deck.busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = active(deck);
    if (!current) return;
    setDraft("");
    setHist(-1);
    deck.addBlock(current.id, { id: freshId(), kind: "user", text: trimmed });
    const command = parseLine(trimmed);
    if (command) {
      apply(current.id, command);
      return;
    }
    void answer(current.id, trimmed);
  }

  async function answer(sessionId: string, text: string) {
    const deck = useDeck.getState();
    const session = deck.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    if (session.mode === "code" && wantsPlayable(text, session.blocks.some((block) => block.kind === "play"))) {
      await ship(sessionId, text);
      return;
    }
    const tokenId = ++run.current;
    deck.setBusy(true);
    const toolId = freshId();
    const apiModel = deck.model === "grok-4" ? "grok-4.3" : "grok-4.5";
    deck.addBlock(sessionId, {
      id: toolId,
      kind: "tool",
      name: "model",
      detail: apiModel,
      state: "run",
    });
    try {
      const plugins = Object.entries(deck.plugins)
        .filter(([, flags]) => flags.installed && flags.enabled)
        .map(([id]) => id);
      const messages: { role: "user" | "assistant"; content: string }[] = [];
      for (const block of session.blocks) {
        if (block.kind === "user") messages.push({ role: "user", content: block.text });
        else if (block.kind === "agent") messages.push({ role: "assistant", content: block.text });
      }
      const result = await completeReply({
        data: {
          model: deck.model,
          mode: session.mode,
          cwd: session.cwd,
          plugins,
          messages: messages.slice(-8),
        },
      });
      if (run.current !== tokenId) return;
      useDeck.getState().patchBlock(sessionId, toolId, { state: "ok" });
      const steps = session.mode === "plan" ? numberedSteps(result.text) : [];
      if (steps.length >= 2) {
        useDeck.getState().setPlan(sessionId, steps);
      }
      useDeck.getState().addBlock(sessionId, { id: freshId(), kind: "agent", text: result.text });
    } catch (error) {
      if (run.current !== tokenId) return;
      useDeck.getState().patchBlock(sessionId, toolId, { state: "ok" });
      const message = error instanceof Error ? error.message : "The model request failed.";
      useDeck.getState().note(sessionId, message);
    } finally {
      if (run.current === tokenId) useDeck.getState().setBusy(false);
    }
  }

  async function ship(sessionId: string, text: string) {
    const tokenId = ++run.current;
    const deck = useDeck.getState();
    const session = deck.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    deck.setBusy(true);
    const toolId = freshId();
    deck.addBlock(sessionId, {
      id: toolId,
      kind: "tool",
      name: "write",
      detail: "game.html",
      state: "run",
    });
    try {
      const messages: { role: "user" | "assistant"; content: string }[] = [];
      for (const block of session.blocks) {
        if (block.kind === "user") messages.push({ role: "user", content: block.text });
        else if (block.kind === "agent") messages.push({ role: "assistant", content: block.text });
      }
      if (messages.length === 0) messages.push({ role: "user", content: text });
      const result = await shipGame({
        data: { cwd: session.cwd, messages: messages.slice(-6) },
      });
      if (run.current !== tokenId) return;
      useDeck.getState().patchBlock(sessionId, toolId, { state: "ok" });
      useDeck.getState().addBlock(sessionId, {
        id: freshId(),
        kind: "tool",
        name: "run",
        detail: "preview",
        state: "ok",
      });
      useDeck.getState().addBlock(sessionId, {
        id: freshId(),
        kind: "play",
        title: result.title,
        html: result.html,
      });
      useDeck.getState().addBlock(sessionId, {
        id: freshId(),
        kind: "agent",
        text: result.summary,
      });
    } catch (error) {
      if (run.current !== tokenId) return;
      useDeck.getState().patchBlock(sessionId, toolId, { state: "ok" });
      const message = error instanceof Error ? error.message : "The build failed.";
      useDeck.getState().note(sessionId, message);
    } finally {
      if (run.current === tokenId) useDeck.getState().setBusy(false);
    }
  }

  function onComposerKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      useDeck.getState().cycleMode();
      return;
    }
    if (showPalette && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setPalette((index) => {
        if (matches.length === 0) return 0;
        if (event.key === "ArrowDown") return (index + 1) % matches.length;
        return (index - 1 + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === "ArrowUp" && !showPalette && draft.trim() === "") {
      const prompts = session.blocks.filter((block) => block.kind === "user");
      if (prompts.length === 0) return;
      event.preventDefault();
      const next = hist < 0 ? prompts.length - 1 : Math.max(0, hist - 1);
      const pick = prompts[next];
      if (pick && pick.kind === "user") {
        setHist(next);
        setDraft(pick.text);
      }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (showPalette && matches[palette] && !matches[palette].args) {
        submit(`/${matches[palette].name}`);
        return;
      }
      if (showPalette && matches[palette]?.args) {
        setDraft(`/${matches[palette].name} `);
        return;
      }
      submit(draft);
    }
  }

  const percent = contextOf(session);

  return (
    <div className="flex h-dvh flex-col bg-ink text-paper">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3">
        <button
          type="button"
          className="h-11 rounded-full px-3 text-sm text-mute hover:bg-raised hover:text-paper md:hidden"
          onClick={() => useDeck.getState().setRail(true)}
        >
          Sessions
        </button>
        <h1 className="font-serif text-2xl leading-none tracking-tight">Grokline</h1>
        <p className="hidden min-w-0 truncate text-xs text-mute sm:block">~/{session.cwd}</p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => useDeck.getState().setDrawer("model")}
            className="hidden h-9 items-center rounded-full bg-raised px-3 text-xs text-mute hover:text-paper sm:flex"
          >
            {model}
          </button>
          {tab === "deck" && <ModeSwitch mode={session.mode} />}
        </div>
      </header>
      <nav className="flex h-11 shrink-0 items-end gap-5 border-b border-line px-4" aria-label="Surface">
        <TabButton on={tab === "deck"} label="Deck" onClick={() => setTab("deck")} />
        <TabButton on={tab === "imagine"} label="Imagine" onClick={() => setTab("imagine")} />
      </nav>

      {tab === "imagine" ? (
        <ImagineTab />
      ) : (
      <div className="flex min-h-0 flex-1">
        <SessionRail
          sessions={sessions}
          activeId={session.id}
          open={rail}
          onClose={() => useDeck.getState().setRail(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scroller}
            onScroll={(event) => {
              const node = event.currentTarget;
              stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
            }}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6" aria-live="polite">
              {session.blocks.length === 0 && (
                <Welcome cwd={session.cwd} onPick={(text) => submit(text)} />
              )}
              {session.blocks.map((block, index) => (
                <BlockView
                  key={block.id}
                  block={block}
                  live={busy && index === session.blocks.length - 1}
                  onDecide={decide}
                />
              ))}
            </div>
          </div>

          <div className="relative px-3 pt-2 pb-3">
            {showPalette && matches.length > 0 && (
              <ul className="menu-pop absolute right-3 bottom-full left-3 z-20 mb-2 max-h-80 overflow-auto rounded-2xl bg-panel p-1 hair md:right-auto md:max-w-md">
                {matches.map((command, index) => (
                  <li key={command.name}>
                    <button
                      type="button"
                      onMouseEnter={() => setPalette(index)}
                      onClick={() => {
                        if (command.args) {
                          setDraft(`/${command.name} `);
                          box.current?.focus();
                          return;
                        }
                        submit(`/${command.name}`);
                      }}
                      className={
                        "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm " +
                        (index === palette ? "bg-raised text-paper" : "text-mute")
                      }
                    >
                      <span className="w-28 shrink-0 text-lime">/{command.name}</span>
                      <span className="truncate">{command.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="composer-well mx-auto flex w-full max-w-3xl items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
            >
              <span className="pb-2 pl-2 text-lime" aria-hidden="true">
                ❯
              </span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Prompt</span>
                <textarea
                  ref={box}
                  value={draft}
                  rows={1}
                  disabled={busy}
                  placeholder={busy ? "Working…" : "Ask, or / for commands"}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setHist(-1);
                    const node = event.target;
                    node.style.height = "0px";
                    node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={onComposerKey}
                  className="max-h-36 w-full resize-none bg-transparent py-2 text-sm leading-relaxed text-paper outline-none placeholder:text-mute disabled:opacity-60"
                />
              </label>
              <button
                type="submit"
                disabled={busy || draft.trim() === ""}
                className="h-10 shrink-0 rounded-lg bg-lime px-4 text-sm text-on-lime transition-transform duration-150 ease-out enabled:active:scale-[0.96] disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
      )}

      <footer className="flex h-11 shrink-0 items-center gap-3 overflow-hidden border-t border-line px-3 text-xs text-mute">
        <span className="text-paper">~/{session.cwd}</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-14 overflow-hidden rounded-full bg-raised" aria-hidden="true">
            <span className="meter-fill block h-full bg-lime" style={{ width: `${percent}%` }} />
          </span>
          <span className="tabular-nums">{percent}%</span>
        </span>
        <span className="hidden capitalize sm:inline">{session.mode}</span>
        <span className="hidden md:inline">shift+tab</span>
        <button
          type="button"
          onClick={() => useDeck.getState().setDrawer("marketplace")}
          className="ml-auto h-11 px-2 text-paper"
        >
          Catalog
        </button>
      </footer>
      <Panel onInstall={(id) => void install(id, session.id)} />
    </div>
  );
}

function TabButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        "h-11 border-b-2 px-1 text-sm " +
        (on ? "border-lime text-paper" : "border-transparent text-mute hover:text-paper")
      }
    >
      {label}
    </button>
  );
}

function ModeSwitch({ mode }: { mode: Mode }) {
  const setMode = useDeck((state) => state.setMode);
  const cycleMode = useDeck((state) => state.cycleMode);
  const modes: Mode[] = ["code", "plan", "ask"];
  const index = Math.max(0, modes.indexOf(mode));
  return (
    <>
      <button
        type="button"
        onClick={() => cycleMode()}
        className="h-11 rounded-full bg-lime px-4 text-xs text-on-lime capitalize sm:hidden"
      >
        {mode}
      </button>
      <div className="mode-track hidden sm:grid sm:grid-cols-3" role="group" aria-label="Session mode">
        <span className="mode-pill" style={{ transform: `translateX(${index * 100}%)` }} />
        {modes.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === mode}
            onClick={() => setMode(item)}
            className={
              "relative z-10 h-9 rounded-full px-3 text-xs capitalize " +
              (item === mode ? "text-on-lime" : "text-mute hover:text-paper")
            }
          >
            {item}
          </button>
        ))}
      </div>
    </>
  );
}

function SessionRail({
  sessions,
  activeId,
  open,
  onClose,
}: {
  sessions: Session[];
  activeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const body = (
    <div className="flex h-full w-64 flex-col bg-panel">
      <div className="flex h-14 items-center justify-between border-b border-line px-3">
        <p className="text-xs tracking-wide text-mute uppercase">Sessions</p>
        <button
          type="button"
          onClick={() => useDeck.getState().newSession()}
          className="h-11 rounded-md px-2 text-sm text-lime"
        >
          New
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {sessions.map((item) => {
          const on = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => useDeck.getState().selectSession(item.id)}
                className={
                  "flex w-full flex-col items-start gap-1 border-l-2 px-3 py-3 text-left " +
                  (on ? "border-lime bg-raised" : "border-transparent hover:bg-ink")
                }
              >
                <span className={"line-clamp-2 text-sm " + (on ? "text-paper" : "text-mute")}>
                  {item.title}
                </span>
                <span className="flex items-center gap-2 text-xs text-mute">
                  <span>~/{item.cwd}</span>
                  <Ago ts={item.created} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full shrink-0 border-r border-line md:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-30 flex md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/80" aria-label="Close sessions" onClick={onClose} />
          <div className="relative h-full border-r border-line">{body}</div>
        </div>
      )}
    </>
  );
}

function Welcome({ cwd, onPick }: { cwd: string; onPick: (text: string) => void }) {
  return (
    <div className="pt-8">
      <p className="rise text-xs tracking-wide text-mute uppercase">~/{cwd}</p>
      <h2 className="rise mt-3 max-w-xl font-serif text-4xl leading-tight sm:text-5xl" style={{ animationDelay: "40ms" }}>
        A deck for the Grok terminal.
      </h2>
      <p
        className="rise mt-4 max-w-xl text-sm leading-relaxed text-pretty text-mute"
        style={{ animationDelay: "80ms" }}
      >
        Slash commands stay in this deck. /imagine makes a still. Prompts are answered by Grok. Nothing here edits files on your computer.
      </p>
      <div className="mt-8 flex flex-col gap-2">
        {STARTERS.map((item, index) => (
          <button
            key={item.n}
            type="button"
            onClick={() => onPick(item.text)}
            style={{ animationDelay: `${120 + index * 40}ms` }}
            className="rise flex h-12 items-center gap-3 rounded-xl bg-panel px-3 text-left text-sm text-paper hair hover:bg-raised"
          >
            <span className="w-8 shrink-0 text-xs text-lime tabular-nums">{item.n}</span>
            <span>{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockView({
  block,
  live,
  onDecide,
}: {
  block: Block;
  live: boolean;
  onDecide: (allow: boolean) => void;
}) {
  if (block.kind === "user") {
    return (
      <article className="grid grid-cols-[3.25rem_1fr] gap-3">
        <p className="pt-0.5 text-xs text-lime">you</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-paper">{block.text}</p>
      </article>
    );
  }
  if (block.kind === "agent") {
    return (
      <article className="grid grid-cols-[3.25rem_1fr] gap-3">
        <p className="pt-0.5 text-xs text-mute">grok</p>
        <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap text-paper">
          {block.text}
          {live && <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 bg-lime align-middle" />}
        </p>
      </article>
    );
  }
  if (block.kind === "note") {
    return <p className="pl-16 text-sm text-mute">{block.text}</p>;
  }
  if (block.kind === "image") {
    return (
      <article className="grid grid-cols-[3.25rem_1fr] gap-3">
        <p className="pt-0.5 text-xs text-lime">still</p>
        <a href={block.url} target="_blank" rel="noreferrer" className="block min-w-0">
          <img
            src={block.url}
            alt={block.prompt}
            className="max-h-96 w-full rounded-xl object-contain hair"
          />
          <p className="mt-2 text-xs text-mute">Open the still. The link expires.</p>
        </a>
      </article>
    );
  }
  if (block.kind === "play") {
    return (
      <article className="overflow-hidden rounded-xl bg-ink hair">
        <div className="flex h-10 items-center justify-between px-3 text-xs">
          <span className="text-paper">{block.title}</span>
          <span className="text-lime">running</span>
        </div>
        <iframe
          title={block.title}
          sandbox="allow-scripts"
          srcDoc={block.html}
          className="h-[32rem] w-full border-0 bg-ink"
        />
      </article>
    );
  }
  if (block.kind === "tool") {
    return (
      <p className="grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-3 text-sm">
        <span className="text-mute">{block.name}</span>
        <span className="truncate text-paper">{block.detail}</span>
        <span className={block.state === "ok" ? "text-mute" : "text-lime"}>
          {block.state === "ok" ? "ok" : "run"}
        </span>
      </p>
    );
  }
  if (block.kind === "plan") {
    return (
      <ol className="ml-16 flex flex-col gap-2 rounded-xl bg-panel p-3 hair">
        {block.steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 text-sm">
            <span className={"tabular-nums " + (step.state === "now" ? "text-lime" : "text-mute")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-paper">{step.title}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="ml-16 rounded-xl bg-panel p-4 hair">
      <p className="text-xs tracking-wide text-clay uppercase">permission</p>
      <p className="mt-2 text-sm text-paper">{block.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-mute">{block.detail}</p>
      {block.decision ? (
        <p className="mt-3 text-sm text-paper">{block.decision === "allow" ? "Allowed" : "Denied"}</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onDecide(true)}
            className="h-11 rounded-lg bg-lime px-4 text-sm text-on-lime transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            Allow
          </button>
          <button
            type="button"
            onClick={() => onDecide(false)}
            className="h-11 rounded-lg px-4 text-sm text-paper hair"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}

function Ago({ ts }: { ts: number }) {
  const [label, setLabel] = useState("now");
  useEffect(() => {
    function tick() {
      if (!ts) {
        setLabel("now");
        return;
      }
      const delta = Math.max(0, Date.now() - ts);
      const mins = Math.floor(delta / 60000);
      if (mins < 1) setLabel("now");
      else if (mins < 60) setLabel(`${mins}m`);
      else setLabel(`${Math.floor(mins / 60)}h`);
    }
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [ts]);
  return <span className="tabular-nums">{label}</span>;
}

function wantsPlayable(text: string, already: boolean) {
  const q = text.toLowerCase();
  const make = /\b(make|create|build|code|write|ship)\b/.test(q);
  const game = /\b(game|playable|arcade|puzzle|snake|tetris|platformer)\b/.test(q);
  if (make && game) return true;
  return already && /\b(harder|faster|slower|restart|another level)\b/.test(q);
}

function numberedSteps(text: string) {
  const steps: string[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (!match) {
      if (steps.length > 0) break;
      continue;
    }
    steps.push(match[1]?.trim() ?? "");
    if (steps.length === 6) break;
  }
  return steps.filter(Boolean);
}

function contextOf(session: Session) {
  const chars = session.blocks.reduce((sum, block) => {
    if (block.kind === "user" || block.kind === "agent" || block.kind === "note") {
      return sum + block.text.length;
    }
    if (block.kind === "image") return sum + block.prompt.length;
    if (block.kind === "play") return sum + block.title.length;
    if (block.kind === "tool") return sum + block.detail.length;
    if (block.kind === "plan") return sum + block.steps.length * 48;
    return sum + 64;
  }, 0);
  return Math.min(96, Math.round((chars / 4800) * 100));
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
