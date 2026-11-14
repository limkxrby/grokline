import type { Mode } from "@/lib/terminal/catalog";
import { env } from "@/lib/env.server";

export type ReplyMessage = { role: "user" | "assistant"; content: string };

export type ReplyInput = {
  model: string;
  mode: Mode;
  cwd: string;
  plugins: string[];
  messages: ReplyMessage[];
};

const MODELS: Record<string, string> = {
  "grok-4.5": "grok-4.5",
  "grok-4": "grok-4.3",
};

export async function complete(input: ReplyInput): Promise<{ text: string }> {
  const key = env("XAI_API_KEY");
  if (!key) throw new Error("No model key is configured on this server.");

  const model = MODELS[input.model] ?? "grok-4.5";
  const plugins = input.plugins.length > 0 ? input.plugins.join(", ") : "none";
  const system = [
    "You are Grok, answering inside a terminal UI called Grokline.",
    `The session label is ~/${input.cwd}. You cannot see or edit files on the user's computer.`,
    "Answer the latest message directly. No greeting, no disclaimer about being a simulation.",
    "If they need a change, give the exact code or steps they can apply. Never claim a tool ran or a file was written.",
    `Mode is ${input.mode}.`,
    input.mode === "ask"
      ? "Answer the question in plain prose. Do not force a plan."
      : input.mode === "plan"
        ? "Reply with 3 to 6 numbered steps, one per line, then a blank line and one sentence. Do not claim you edited anything."
        : "If they asked how something works, explain it. If they asked for a snippet, keep it short. Do not paste a whole program.",
    `Enabled plugins: ${plugins}.`,
    "If Superpowers is enabled and they asked to change behavior, say the failing test first, then the change. Otherwise do not lecture about plugins.",
    "Keep it short enough to read in a terminal.",
    "You cannot generate images. If they want a picture, tell them to type /imagine followed by a description. An optional ratio can come first, such as /imagine 16:9 a bench synth.",
  ].join("\n");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: input.mode === "ask" ? 700 : 1200,
      messages: [{ role: "system", content: system }, ...input.messages],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`Model request failed (${response.status}).`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The model returned an empty reply.");
  return { text };
}

const RATIOS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"]);

export async function imagine(input: { prompt: string; aspect?: string }): Promise<{ url: string }> {
  const key = env("XAI_API_KEY");
  if (!key) throw new Error("No model key is configured on this server.");
  const prompt = input.prompt.trim();
  if (prompt.length < 3) throw new Error("Describe the image in a few words.");

  const body: Record<string, unknown> = {
    model: "grok-imagine-image-2.0",
    prompt: prompt.slice(0, 2000),
    n: 1,
    quality: "medium",
    resolution: "1k",
    response_format: "url",
  };
  if (input.aspect && RATIOS.has(input.aspect)) body.aspect_ratio = input.aspect;

  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) throw new Error(`Imagine failed (${response.status}).`);
  const json = (await response.json()) as { data?: { url?: string }[] };
  const url = json.data?.[0]?.url;
  if (!url) throw new Error("Imagine returned no image.");
  return { url };
}

export async function ship(input: {
  cwd: string;
  messages: ReplyMessage[];
}): Promise<{ title: string; summary: string; html: string }> {
  const key = env("XAI_API_KEY");
  if (!key) throw new Error("No model key is configured on this server.");
  const system = [
    "You are a coding agent. The user asked for something they can play.",
    "Do not reply with an explanation or a code listing. Build the game.",
    `Session label ~/${input.cwd}. The game runs in a sandboxed iframe, not on their computer.`,
    "Reply in exactly this shape and nothing else. No code fence.",
    "TITLE: short name",
    "SUMMARY: one sentence",
    "HTML:",
    "<!DOCTYPE html>",
    "Then the rest of a complete HTML document.",
    "Rules for the document:",
    "- One file. No CDN, no fetch, no localStorage, no alert, no external images.",
    "- Playable immediately with the pointer and the keyboard.",
    "- Show a score. R or a Restart control starts again.",
    "- Fit a frame about 480px tall. Background #10110e, text #e7edd8, accent #d6f25c.",
    "- A real loop or turns, not a static page and not a tutorial.",
  ].join("\n");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.4,
      max_tokens: 8000,
      messages: [{ role: "system", content: system }, ...input.messages],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) throw new Error(`Build failed (${response.status}).`);
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("The build returned nothing.");
  return parseShip(raw);
}

function parseShip(raw: string): { title: string; summary: string; html: string } {
  const title = raw.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim().slice(0, 60) || "Game";
  const summary =
    raw.match(/^SUMMARY:\s*(.+)$/m)?.[1]?.trim().slice(0, 280) || "Play it in the preview.";
  const doc = raw.search(/<!DOCTYPE html/i);
  const tag = raw.search(/<html[\s>]/i);
  const start = doc >= 0 ? doc : tag;
  if (start < 0) throw new Error("The build did not return a playable game.");
  let html = raw.slice(start).trim().replace(/\s*```$/, "");
  if (!/<\/html>/i.test(html)) throw new Error("The game was cut off. Ask again.");
  if (html.length > 80_000) html = html.slice(0, 80_000);
  return { title, summary, html };
}
