import type { Mode } from "@/lib/terminal/catalog";
import type { Beat } from "@/lib/terminal/types";

type Ctx = {
  mode: Mode;
  cwd: string;
  superpowers: boolean;
};

export function beatsFor(input: string, ctx: Ctx): Beat[] {
  const q = input.toLowerCase();

  if (ctx.mode === "ask") {
    return [{ t: "say", text: ask(q, ctx) }];
  }

  if (ctx.mode === "plan") {
    const steps = planSteps(q, ctx);
    return [
      { t: "plan", steps },
      {
        t: "say",
        text: "Plan only — no files touched. Shift+tab to code when a step is worth writing.",
      },
    ];
  }

  if (/\b(deploy|force-push|force push|drop table|rm\b|delete all)\b/.test(q)) {
    return [
      {
        t: "permit",
        title: "This step can destroy work",
        detail: `Project ~/${ctx.cwd}. Allow to simulate it here. Nothing on your computer runs.`,
        then: [
          { t: "tool", name: "shell", detail: "simulated · no process spawned" },
          {
            t: "say",
            text: "Simulated and stopped. A real Grok session would have paused on the same prompt before touching the repo.",
          },
        ],
      },
    ];
  }

  if (/\b(bug|broken|failing|flicker|error|crash)\b/.test(q)) {
    return debugBeats(ctx);
  }

  if (/\b(test|tdd|failing test)\b/.test(q)) {
    return testBeats(ctx);
  }

  if (/\b(plugin|superpowers|marketplace)\b/.test(q)) {
    return [
      { t: "tool", name: "read", detail: "marketplace · xai-official" },
      {
        t: "say",
        text: ctx.superpowers
          ? "Superpowers is enabled. New work should brainstorm, write a short plan, then land a failing test before production code. Open /skills to see the set."
          : "Superpowers is in the official catalog as superpowers@xai-official. Open /marketplace, trust its hook, and install. Or paste: grok plugin install superpowers@xai-official --trust",
      },
    ];
  }

  return [
    { t: "tool", name: "read", detail: `${ctx.cwd}/AGENTS.md` },
    { t: "tool", name: "grep", detail: clip(input) },
    {
      t: "say",
      text: ctx.superpowers
        ? `I would not edit ~/${ctx.cwd} yet. Superpowers wants a failing test that names the behavior, then the smallest change that turns it green. Say the behavior you want pinned, or shift+tab into plan.`
        : `Read ~/${ctx.cwd} and stopped before editing. Shift+tab for a plan, or install Superpowers if you want the test-first loop enforced. This deck only simulates the session.`,
    },
  ];
}

function debugBeats(ctx: Ctx): Beat[] {
  if (!ctx.superpowers) {
    return [
      { t: "tool", name: "read", detail: `${ctx.cwd}/src` },
      {
        t: "say",
        text: "I can guess, but Superpowers would refuse that. Install it, then the loop is: reproduce, localize, one hypothesis, one experiment. No patch before the cause is named.",
      },
    ];
  }
  return [
    { t: "tool", name: "read", detail: `${ctx.cwd}/src` },
    { t: "tool", name: "grep", detail: "failing assertion" },
    {
      t: "say",
      text: "Systematic debugging. 1) Reproduce it in one command. 2) Name the line that lies. 3) One hypothesis. 4) An experiment that can falsify it. I have not changed code.",
    },
  ];
}

function testBeats(ctx: Ctx): Beat[] {
  if (!ctx.superpowers) {
    return [
      {
        t: "say",
        text: "Without Superpowers this deck will not pretend to write the test. Install superpowers@xai-official and the rule is simple: red test, then code, then green. Nothing else counts as done.",
      },
    ];
  }
  return [
    { t: "tool", name: "write", detail: `${ctx.cwd}/test · failing case first` },
    { t: "tool", name: "shell", detail: "test runner · expected fail" },
    {
      t: "say",
      text: "The test is the spec. It should fail for the reason you care about, not a typo. Implementation comes after that failure is real. Verification-before-completion stays on until the runner is green for the right reason.",
    },
  ];
}

function planSteps(q: string, ctx: Ctx): string[] {
  const topic = clip(q.replace(/^plan\s+/, "")) || `the work in ~/${ctx.cwd}`;
  const test = ctx.superpowers
    ? "Write the failing test that pins the behavior."
    : "Decide how you will know it worked.";
  return [
    `Restate the outcome for ${topic} in one sentence.`,
    "Split the work into tasks under five minutes.",
    test,
    "Implement only enough to satisfy that check.",
    "Verify, then stop.",
  ];
}

function ask(q: string, ctx: Ctx): string {
  if (q.includes("compact")) {
    return "/compact folds older turns into a short note so the context meter drops. The real CLI does this against the model window. Here it just trims the transcript.";
  }
  if (q.includes("superpower") || q.includes("plugin")) {
    return ctx.superpowers
      ? "Superpowers is on. It is a skill pack, not a model: design first, tiny tasks, test before code, review before you call it finished. The hook is trusted on this deck only."
      : "Superpowers ships in xAI's official marketplace. The CLI line is grok plugin install superpowers@xai-official --trust. --trust lets its hook run. This deck copies that choice locally and does not install anything on your computer.";
  }
  if (q.includes("mode") || q.includes("plan")) {
    return "Shift+tab cycles code, plan, and ask. Plan writes a checklist and edits nothing. Ask answers and edits nothing. Code may show tool rows, and it stops on anything destructive.";
  }
  return `Ask mode stays read-only. In ~/${ctx.cwd} I would answer from the repo, not change it. Shift+tab when you want a plan or a patch.`;
}

function clip(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 48)}…`;
}
