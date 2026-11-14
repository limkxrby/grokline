import { create } from "zustand";
import { MODES, type Mode } from "@/lib/terminal/catalog";
import type { Block, BlockPatch, Drawer, PlanStep, PluginFlags, Session, Still } from "@/lib/terminal/types";

const STORAGE_KEY = "grokline.v1";

export const WELCOME_ID = "sess-welcome";

type Saved = {
  sessions: Session[];
  activeId: string;
  model: string;
  plugins: Record<string, PluginFlags>;
  stills: Still[];
};

type Deck = Saved & {
  drawer: Drawer | null;
  rail: boolean;
  busy: boolean;
  pendingInstall: string | null;
  hydrated: boolean;
  setDrawer: (drawer: Drawer | null) => void;
  setRail: (rail: boolean) => void;
  setBusy: (busy: boolean) => void;
  setPendingInstall: (id: string | null) => void;
  setModel: (model: string) => void;
  setMode: (mode: Mode) => void;
  cycleMode: () => void;
  selectSession: (id: string) => void;
  addBlock: (sessionId: string, block: Block) => void;
  patchBlock: (sessionId: string, blockId: string, patch: BlockPatch) => void;
  setPlan: (sessionId: string, steps: string[]) => void;
  note: (sessionId: string, text: string) => void;
  newSession: () => string;
  forkSession: () => void;
  renameSession: (title: string) => void;
  setCwd: (cwd: string) => void;
  compact: () => void;
  focusStep: (index: number) => void;
  installPlugin: (id: string) => void;
  setPluginEnabled: (id: string, enabled: boolean) => void;
  uninstallPlugin: (id: string) => void;
  addStill: (still: Still) => void;
  hydrate: (saved: Saved) => void;
  markHydrated: () => void;
  reset: () => void;
};

function welcomeSession(): Session {
  return {
    id: WELCOME_ID,
    title: "New session",
    cwd: "filament",
    mode: "code",
    blocks: [],
    plan: [],
    created: 0,
  };
}

function initial(): Saved {
  return {
    sessions: [welcomeSession()],
    activeId: WELCOME_ID,
    model: "grok-4.5",
    plugins: {},
    stills: [],
  };
}

function uid() {
  return crypto.randomUUID();
}

function retitle(session: Session, block: Block): string {
  if (session.title !== "New session" || block.kind !== "user") return session.title;
  const text = block.text.replace(/\s+/g, " ").trim();
  if (!text || text.startsWith("/")) return session.title;
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function mapSession(sessions: Session[], id: string, fn: (session: Session) => Session) {
  return sessions.map((session) => (session.id === id ? fn(session) : session));
}

export const useDeck = create<Deck>((set, get) => ({
  ...initial(),
  drawer: null,
  rail: false,
  busy: false,
  pendingInstall: null,
  hydrated: false,
  setDrawer: (drawer) => set({ drawer }),
  setRail: (rail) => set({ rail }),
  setBusy: (busy) => set({ busy }),
  setPendingInstall: (pendingInstall) => set({ pendingInstall }),
  setModel: (model) => set({ model }),
  setMode: (mode) => {
    const { sessions, activeId } = get();
    set({
      sessions: mapSession(sessions, activeId, (session) => ({ ...session, mode })),
    });
  },
  cycleMode: () => {
    const session = active(get());
    const index = MODES.indexOf(session.mode);
    get().setMode(MODES[(index + 1) % MODES.length] ?? "code");
  },
  selectSession: (activeId) => set({ activeId, rail: false }),
  addBlock: (sessionId, block) =>
    set({
      sessions: mapSession(get().sessions, sessionId, (session) => ({
        ...session,
        title: retitle(session, block),
        blocks: [...session.blocks, block],
      })),
    }),
  patchBlock: (sessionId, blockId, patch) =>
    set({
      sessions: mapSession(get().sessions, sessionId, (session) => ({
        ...session,
        blocks: session.blocks.map((block) =>
          block.id === blockId ? ({ ...block, ...patch } as Block) : block,
        ),
      })),
    }),
  setPlan: (sessionId, steps) => {
    const plan: PlanStep[] = steps.map((title, index) => ({
      title,
      state: index === 0 ? "now" : "wait",
    }));
    set({
      sessions: mapSession(get().sessions, sessionId, (session) => ({ ...session, plan })),
    });
    get().addBlock(sessionId, { id: uid(), kind: "plan", steps: plan });
  },
  note: (sessionId, text) => {
    get().addBlock(sessionId, { id: uid(), kind: "note", text });
  },
  newSession: () => {
    const id = uid();
    const previous = active(get());
    const session: Session = {
      id,
      title: "New session",
      cwd: previous.cwd,
      mode: previous.mode,
      blocks: [],
      plan: [],
      created: Date.now(),
    };
    set({ sessions: [session, ...get().sessions], activeId: id, rail: false });
    return id;
  },
  forkSession: () => {
    const current = active(get());
    const id = uid();
    const copy: Session = {
      ...current,
      id,
      title: `${current.title} · fork`,
      blocks: current.blocks.map((block) => ({ ...block })),
      plan: current.plan.map((step) => ({ ...step })),
      created: Date.now(),
    };
    set({ sessions: [copy, ...get().sessions], activeId: id });
  },
  renameSession: (title) => {
    const name = title.trim();
    if (!name) return;
    const { sessions, activeId } = get();
    set({
      sessions: mapSession(sessions, activeId, (session) => ({ ...session, title: name })),
    });
  },
  setCwd: (cwd) => {
    const { sessions, activeId } = get();
    set({
      sessions: mapSession(sessions, activeId, (session) => ({ ...session, cwd })),
    });
  },
  compact: () => {
    const { sessions, activeId } = get();
    set({
      sessions: mapSession(sessions, activeId, (session) => {
        const lastUser = [...session.blocks]
          .reverse()
          .find((block) => block.kind === "user" && !block.text.startsWith("/"));
        const blocks: Block[] = [
          {
            id: uid(),
            kind: "note",
            text: "Compacted. Older turns folded into this note.",
          },
        ];
        if (lastUser && lastUser.kind === "user") blocks.push({ ...lastUser, id: uid() });
        return { ...session, blocks };
      }),
    });
  },
  focusStep: (index) => {
    const session = active(get());
    if (!session.plan.length) return;
    const plan: PlanStep[] = session.plan.map((step, stepIndex) => ({
      ...step,
      state: stepIndex < index ? "done" : stepIndex === index ? "now" : "wait",
    }));
    let lastPlan = -1;
    session.blocks.forEach((block, blockIndex) => {
      if (block.kind === "plan") lastPlan = blockIndex;
    });
    set({
      sessions: mapSession(get().sessions, session.id, (current) => ({
        ...current,
        plan,
        blocks: current.blocks.map((block, blockIndex) =>
          blockIndex === lastPlan && block.kind === "plan" ? { ...block, steps: plan } : block,
        ),
      })),
    });
  },
  installPlugin: (id) =>
    set({
      plugins: {
        ...get().plugins,
        [id]: { installed: true, enabled: true, trusted: true },
      },
      pendingInstall: null,
    }),
  setPluginEnabled: (id, enabled) => {
    const current = get().plugins[id];
    if (!current?.installed) return;
    set({ plugins: { ...get().plugins, [id]: { ...current, enabled } } });
  },
  uninstallPlugin: (id) => {
    const next = { ...get().plugins };
    delete next[id];
    set({ plugins: next });
  },
  addStill: (still) => set({ stills: [still, ...get().stills].slice(0, 24) }),
  hydrate: (saved) =>
    set({
      sessions: saved.sessions.length > 0 ? saved.sessions : [welcomeSession()],
      activeId: saved.activeId,
      model: saved.model,
      plugins: saved.plugins,
      stills: saved.stills ?? [],
      hydrated: true,
    }),
  markHydrated: () => set({ hydrated: true }),
  reset: () => {
    set({ ...initial(), drawer: null, rail: false, busy: false, pendingInstall: null, hydrated: true });
    localStorage.removeItem(STORAGE_KEY);
  },
}));

export function active(state: Saved) {
  return state.sessions.find((session) => session.id === state.activeId) ?? state.sessions[0];
}

export function flagsFor(plugins: Record<string, PluginFlags>, id: string): PluginFlags {
  return plugins[id] ?? { installed: false, enabled: false, trusted: false };
}

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (!Array.isArray(parsed.sessions) || typeof parsed.activeId !== "string") return null;
    return {
      sessions: parsed.sessions,
      activeId: parsed.activeId,
      model: typeof parsed.model === "string" ? parsed.model : "grok-4.5",
      plugins: parsed.plugins && typeof parsed.plugins === "object" ? parsed.plugins : {},
      stills: Array.isArray(parsed.stills) ? parsed.stills.filter(isStill).slice(0, 24) : [],
    };
  } catch {
    return null;
  }
}

export function saveDeck(state: Saved) {
  const payload: Saved = {
    sessions: state.sessions,
    activeId: state.activeId,
    model: state.model,
    plugins: state.plugins,
    stills: state.stills ?? [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function isStill(value: unknown): value is Still {
  if (!value || typeof value !== "object") return false;
  const still = value as Partial<Still>;
  return (
    typeof still.id === "string" &&
    typeof still.prompt === "string" &&
    typeof still.url === "string" &&
    typeof still.aspect === "string"
  );
}

export function freshId() {
  return crypto.randomUUID();
}
