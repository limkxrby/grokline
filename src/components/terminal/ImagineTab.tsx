import { useState } from "react";
import { imagineStill } from "@/lib/terminal/reply";
import { freshId, useDeck } from "@/lib/terminal/store";

const RATIOS = ["1:1", "16:9", "9:16", "3:2", "2:3"] as const;

export function ImagineTab() {
  const stills = useDeck((state) => state.stills);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof RATIOS)[number]>("1:1");
  const [making, setMaking] = useState(false);
  const [error, setError] = useState("");

  async function make() {
    const text = prompt.trim();
    if (!text || making) return;
    setMaking(true);
    setError("");
    try {
      const result = await imagineStill({ data: { prompt: text, aspect } });
      useDeck.getState().addStill({ id: freshId(), prompt: text, url: result.url, aspect });
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Imagine failed.");
    } finally {
      setMaking(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
          {stills.length === 0 && !making && (
            <div className="pt-8">
              <p className="text-xs tracking-wide text-mute uppercase">Imagine</p>
              <h2 className="mt-3 max-w-xl font-serif text-4xl leading-tight">A still, not a paragraph.</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-pretty text-mute">
                Describe the frame. Pick a ratio. The image stays on this tab. The link expires, and
                nothing is saved to your computer.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {making && (
              <div className="flex aspect-square items-end rounded-xl bg-panel p-3 hair">
                <p className="text-sm text-lime">Making…</p>
              </div>
            )}
            {stills.map((still) => (
              <a
                key={still.id}
                href={still.url}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-xl bg-panel hair"
              >
                <img
                  src={still.url}
                  alt={still.prompt}
                  className={
                    "w-full object-cover " +
                    (still.aspect === "9:16" || still.aspect === "2:3" ? "aspect-[2/3]" : "aspect-square")
                  }
                />
                <p className="line-clamp-2 px-3 py-2 text-xs text-mute">{still.prompt}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
      <form
        className="border-t border-line px-3 pt-3 pb-3"
        onSubmit={(event) => {
          event.preventDefault();
          void make();
        }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
          <div className="flex gap-1" role="group" aria-label="Frame">
            {RATIOS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                aria-pressed={ratio === aspect}
                onClick={() => setAspect(ratio)}
                className={
                  "h-9 rounded-full px-3 text-xs tabular-nums " +
                  (ratio === aspect ? "bg-lime text-on-lime" : "text-mute hover:text-paper")
                }
              >
                {ratio}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-clay">{error}</p>}
          <div className="composer-well flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Image prompt</span>
              <textarea
                value={prompt}
                rows={1}
                disabled={making}
                placeholder={making ? "Making…" : "Describe a still"}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  const node = event.target;
                  node.style.height = "0px";
                  node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void make();
                  }
                }}
                className="max-h-32 w-full resize-none bg-transparent py-2 text-sm leading-relaxed text-paper outline-none placeholder:text-mute disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={making || prompt.trim() === ""}
              className="h-10 shrink-0 rounded-lg bg-lime px-4 text-sm text-on-lime transition-transform duration-150 ease-out enabled:active:scale-[0.96] disabled:opacity-40"
            >
              Make
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
