import { createServerFn } from "@tanstack/react-start";
import type { Mode } from "@/lib/terminal/catalog";
import type { ReplyInput, ReplyMessage } from "@/lib/terminal/reply.server";

function asReplyInput(input: unknown): ReplyInput {
  if (!input || typeof input !== "object") throw new Error("Bad request.");
  const data = input as Partial<ReplyInput>;
  const mode: Mode = data.mode === "plan" || data.mode === "ask" ? data.mode : "code";
  const model = typeof data.model === "string" ? data.model.slice(0, 40) : "grok-4.5";
  const cwd =
    typeof data.cwd === "string" ? data.cwd.replace(/[^\w.-]/g, "").slice(0, 40) || "filament" : "filament";
  const plugins = Array.isArray(data.plugins)
    ? data.plugins
        .filter((item): item is string => typeof item === "string")
        .slice(0, 12)
        .map((item) => item.slice(0, 40))
    : [];
  const messages: ReplyMessage[] = [];
  if (Array.isArray(data.messages)) {
    for (const item of data.messages.slice(-10)) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<ReplyMessage>;
      if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") continue;
      const content = row.content.trim().slice(0, 6000);
      if (!content) continue;
      messages.push({ role: row.role, content });
    }
  }
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    throw new Error("Nothing to answer.");
  }
  return { model, mode, cwd, plugins, messages };
}

export const completeReply = createServerFn({ method: "POST" })
  .validator(asReplyInput)
  .handler(async ({ data }) => {
    const { complete } = await import("./reply.server");
    return complete(data);
  });

const RATIOS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"]);

function asImagineInput(input: unknown): { prompt: string; aspect?: string } {
  if (!input || typeof input !== "object") throw new Error("Bad request.");
  const data = input as { prompt?: unknown; aspect?: unknown };
  if (typeof data.prompt !== "string") throw new Error("Describe the image in a few words.");
  const prompt = data.prompt.trim().slice(0, 2000);
  if (prompt.length < 3) throw new Error("Describe the image in a few words.");
  const aspect = typeof data.aspect === "string" && RATIOS.has(data.aspect) ? data.aspect : undefined;
  return { prompt, aspect };
}

export const imagineStill = createServerFn({ method: "POST" })
  .validator(asImagineInput)
  .handler(async ({ data }) => {
    const { imagine } = await import("./reply.server");
    return imagine(data);
  });

function asShipInput(input: unknown): { cwd: string; messages: ReplyMessage[] } {
  if (!input || typeof input !== "object") throw new Error("Bad request.");
  const data = input as { cwd?: unknown; messages?: unknown };
  const cwd =
    typeof data.cwd === "string" ? data.cwd.replace(/[^\w.-]/g, "").slice(0, 40) || "filament" : "filament";
  const messages: ReplyMessage[] = [];
  if (Array.isArray(data.messages)) {
    for (const item of data.messages.slice(-8)) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<ReplyMessage>;
      if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") continue;
      const content = row.content.trim().slice(0, 4000);
      if (!content) continue;
      messages.push({ role: row.role, content });
    }
  }
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    throw new Error("Nothing to build.");
  }
  return { cwd, messages };
}

export const shipGame = createServerFn({ method: "POST" })
  .validator(asShipInput)
  .handler(async ({ data }) => {
    const { ship } = await import("./reply.server");
    return ship(data);
  });
