export const APP_NAME = "Grokline";

export type Mode = "code" | "plan" | "ask";

export const MODES: Mode[] = ["code", "plan", "ask"];

export const MODELS = [
  { id: "grok-4.5", note: "Current Grok Build default" },
  { id: "grok-4", note: "General reasoning" },
] as const;

export const PROJECTS = ["filament", "synapse-lab", "keel", "blackbox", "grokline"] as const;

export type CommandName =
  | "marketplace"
  | "plugins"
  | "skills"
  | "plan"
  | "model"
  | "new"
  | "sessions"
  | "rename"
  | "fork"
  | "compact"
  | "context"
  | "cd"
  | "imagine"
  | "help";

export const COMMANDS: { name: CommandName; hint: string; args?: string }[] = [
  { name: "marketplace", hint: "Official xai-official catalog" },
  { name: "plugins", hint: "Installed plugins on this deck" },
  { name: "skills", hint: "Skills from enabled plugins" },
  { name: "plan", hint: "The working plan for this session" },
  { name: "model", hint: "Switch the model" },
  { name: "new", hint: "Start a fresh session" },
  { name: "sessions", hint: "Show the session rail" },
  { name: "rename", hint: "Rename this session", args: "title" },
  { name: "fork", hint: "Branch a copy of this session" },
  { name: "compact", hint: "Fold the transcript to free context" },
  { name: "context", hint: "How full this session is" },
  { name: "cd", hint: "Change the project folder", args: "project" },
  { name: "imagine", hint: "Make a still with Imagine", args: "prompt" },
  { name: "help", hint: "Keys and commands" },
];

export type CatalogPlugin = {
  id: string;
  name: string;
  spec: string;
  category: string;
  blurb: string;
  skills: { id: string; about: string }[];
  hooks: number;
  mcp: boolean;
};

export const CATALOG: CatalogPlugin[] = [
  {
    id: "superpowers",
    name: "Superpowers",
    spec: "superpowers@xai-official",
    category: "development",
    blurb:
      "Plan, test, then code. Test-driven development, systematic debugging, and a review gate. Vendored from obra/superpowers.",
    skills: [
      { id: "brainstorming", about: "Agree the design before any code." },
      { id: "writing-plans", about: "Split work into tasks of a few minutes." },
      { id: "test-driven-development", about: "A failing test comes before the change." },
      { id: "systematic-debugging", about: "Find the cause before proposing a fix." },
      { id: "subagent-driven-development", about: "One fresh pass per task." },
      { id: "verification-before-completion", about: "Evidence before calling it done." },
    ],
    hooks: 1,
    mcp: false,
  },
  {
    id: "vercel",
    name: "Vercel",
    spec: "vercel@xai-official",
    category: "deployment",
    blurb: "Deployments, build status, logs, and domains from the session.",
    skills: [
      { id: "deploy", about: "Ship the current project and read the build log." },
      { id: "logs", about: "Pull runtime logs for a deployment." },
    ],
    hooks: 0,
    mcp: true,
  },
  {
    id: "sentry",
    name: "Sentry",
    spec: "sentry@xai-official",
    category: "monitoring",
    blurb: "Production issues, stack traces, and fingerprints without leaving the prompt.",
    skills: [{ id: "issues", about: "Search issues and read the stack that matters." }],
    hooks: 0,
    mcp: true,
  },
  {
    id: "figma",
    name: "Figma",
    spec: "figma@xai-official",
    category: "design",
    blurb: "Read a frame, implement it, and write back to the canvas.",
    skills: [{ id: "implement-design", about: "Turn a selected frame into interface code." }],
    hooks: 0,
    mcp: true,
  },
  {
    id: "neon",
    name: "Neon",
    spec: "neon@xai-official",
    category: "database",
    blurb: "Serverless Postgres: projects, branches, and connection strings.",
    skills: [{ id: "branch", about: "Create a database branch before a risky migration." }],
    hooks: 0,
    mcp: true,
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    spec: "firecrawl@xai-official",
    category: "research",
    blurb: "Scrape, crawl, and extract pages as clean text for the session.",
    skills: [{ id: "scrape", about: "Fetch one URL as markdown." }],
    hooks: 0,
    mcp: true,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    spec: "cloudflare@xai-official",
    category: "development",
    blurb: "Workers, Durable Objects, Wrangler, and web performance skills.",
    skills: [{ id: "workers", about: "Author and check a Worker against the platform." }],
    hooks: 0,
    mcp: false,
  },
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    spec: "chrome-devtools@xai-official",
    category: "development",
    blurb: "Inspect a live browser: console, network, and performance traces.",
    skills: [{ id: "trace", about: "Record a trace and name the slow frame." }],
    hooks: 0,
    mcp: true,
  },
];

export function pluginById(id: string) {
  return CATALOG.find((plugin) => plugin.id === id);
}

export function pluginBySpec(spec: string) {
  const name = spec.split("@")[0]?.trim().toLowerCase();
  return CATALOG.find((plugin) => plugin.id === name || plugin.spec === spec.trim());
}
