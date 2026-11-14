import type { Mode } from "@/lib/terminal/catalog";

export type ToolState = "run" | "ok";

export type PlanStep = {
  title: string;
  state: "done" | "now" | "wait";
};

export type Block =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "note"; text: string }
  | { id: string; kind: "agent"; text: string }
  | { id: string; kind: "image"; prompt: string; url: string }
  | { id: string; kind: "play"; title: string; html: string }
  | { id: string; kind: "tool"; name: string; detail: string; state: ToolState }
  | { id: string; kind: "plan"; steps: PlanStep[] }
  | {
      id: string;
      kind: "permit";
      title: string;
      detail: string;
      decision?: "allow" | "deny";
    };

export type Session = {
  id: string;
  title: string;
  cwd: string;
  mode: Mode;
  blocks: Block[];
  plan: PlanStep[];
  created: number;
};

export type PluginFlags = {
  installed: boolean;
  enabled: boolean;
  trusted: boolean;
};

export type Still = {
  id: string;
  prompt: string;
  url: string;
  aspect: string;
};

export type Drawer =
  | "marketplace"
  | "plugins"
  | "skills"
  | "plan"
  | "model"
  | "help";

export type BlockPatch = {
  text?: string;
  state?: ToolState;
  decision?: "allow" | "deny";
  steps?: PlanStep[];
};

export type Beat =
  | { t: "tool"; name: string; detail: string }
  | { t: "say"; text: string }
  | { t: "plan"; steps: string[] }
  | { t: "permit"; title: string; detail: string; then: Beat[] };
