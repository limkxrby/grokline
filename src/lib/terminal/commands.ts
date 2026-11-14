import { COMMANDS, PROJECTS, pluginBySpec, type CommandName } from "@/lib/terminal/catalog";
import type { Drawer } from "@/lib/terminal/types";

export type CommandResult =
  | { type: "drawer"; drawer: Drawer }
  | { type: "sessions" }
  | { type: "new" }
  | { type: "fork" }
  | { type: "compact" }
  | { type: "context" }
  | { type: "rename"; title: string }
  | { type: "cd"; cwd: string }
  | { type: "install"; spec: string; trust: boolean }
  | { type: "imagine"; prompt: string; aspect?: string }
  | { type: "note"; text: string }
  | { type: "unknown"; text: string };

const DRAWERS: Partial<Record<CommandName, Drawer>> = {
  marketplace: "marketplace",
  plugins: "plugins",
  skills: "skills",
  plan: "plan",
  model: "model",
  help: "help",
};

const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"];

export function parseLine(raw: string): CommandResult | null {
  const line = raw.trim();
  const install = line.match(/^(?:grok\s+)?plugin\s+install\s+(\S+)(?:\s+(--trust))?\s*$/i);
  if (install) {
    const spec = install[1] ?? "";
    const known = pluginBySpec(spec);
    if (!known) {
      return {
        type: "note",
        text: `No plugin named ${spec} in the bundled xai-official catalog.`,
      };
    }
    if (!install[2]) {
      return {
        type: "note",
        text: `Stopped. ${known.spec} needs --trust before its hook can load. Try: grok plugin install ${known.spec} --trust`,
      };
    }
    return { type: "install", spec: known.spec, trust: true };
  }

  if (!line.startsWith("/")) return null;
  const [head, ...rest] = line.slice(1).split(/\s+/);
  const name = (head ?? "").toLowerCase();
  const arg = rest.join(" ").trim();
  const known = COMMANDS.find((command) => command.name === name);
  if (!known) return { type: "unknown", text: `No command /${name}. /help lists this deck.` };

  const drawer = DRAWERS[known.name];
  if (drawer) return { type: "drawer", drawer };
  if (known.name === "sessions") return { type: "sessions" };
  if (known.name === "new") return { type: "new" };
  if (known.name === "fork") return { type: "fork" };
  if (known.name === "compact") return { type: "compact" };
  if (known.name === "context") return { type: "context" };
  if (known.name === "rename") {
    if (!arg) return { type: "note", text: "Usage: /rename session title" };
    return { type: "rename", title: arg };
  }
  if (known.name === "cd") {
    const cwd = arg.replace(/^~\//, "");
    if (!cwd) {
      return { type: "note", text: `Usage: /cd ${PROJECTS.join(" | ")}` };
    }
    return { type: "cd", cwd };
  }
  if (known.name === "imagine") {
    if (!arg) return { type: "note", text: "Usage: /imagine a lime trace on a dark olive scope" };
    const [ratio, ...tail] = arg.split(/\s+/);
    if (ratio && RATIOS.includes(ratio) && tail.length > 0) {
      return { type: "imagine", aspect: ratio, prompt: tail.join(" ") };
    }
    return { type: "imagine", prompt: arg };
  }
  return { type: "unknown", text: `/${name} is not wired.` };
}
