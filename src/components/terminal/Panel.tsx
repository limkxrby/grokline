import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, MODELS, PROJECTS, pluginById } from "@/lib/terminal/catalog";
import { active, flagsFor, useDeck } from "@/lib/terminal/store";

export function Panel({ onInstall }: { onInstall: (id: string) => void }) {
  const drawer = useDeck((state) => state.drawer);
  const setDrawer = useDeck((state) => state.setDrawer);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (drawer) closeRef.current?.focus();
  }, [drawer]);

  if (!drawer) return null;

  const title =
    drawer === "marketplace"
      ? "Marketplace"
      : drawer === "plugins"
        ? "Plugins"
        : drawer === "skills"
          ? "Skills"
          : drawer === "plan"
            ? "Plan"
            : drawer === "model"
              ? "Model"
              : "Help";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="sheet-backdrop absolute inset-0"
        aria-label="Close panel"
        onClick={() => setDrawer(null)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet relative flex h-full w-full max-w-md flex-col border-l border-line bg-panel"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <div>
            <p className="text-xs tracking-wide text-mute uppercase">xai-official</p>
            <h2 className="font-serif text-2xl leading-none">{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setDrawer(null)}
            className="h-11 rounded-md px-3 text-sm text-mute transition-colors hover:bg-raised hover:text-paper"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {drawer === "marketplace" && <Marketplace onInstall={onInstall} />}
          {drawer === "plugins" && <Installed />}
          {drawer === "skills" && <Skills />}
          {drawer === "plan" && <Plan />}
          {drawer === "model" && <Models />}
          {drawer === "help" && <Help />}
        </div>
      </aside>
    </div>
  );
}

function Marketplace({ onInstall }: { onInstall: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [armed, setArmed] = useState<Record<string, boolean>>({});
  const plugins = useDeck((state) => state.plugins);
  const pending = useDeck((state) => state.pendingInstall);
  const setEnabled = useDeck((state) => state.setPluginEnabled);
  const uninstall = useDeck((state) => state.uninstallPlugin);
  const needle = query.trim().toLowerCase();
  const list = CATALOG.filter((plugin) => {
    if (!needle) return true;
    return (
      plugin.name.toLowerCase().includes(needle) ||
      plugin.spec.includes(needle) ||
      plugin.category.includes(needle)
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="sr-only">Search plugins</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the catalog"
          className="h-11 w-full rounded-xl bg-raised px-3 text-sm text-paper outline-none placeholder:text-mute hair"
        />
      </label>
      <p className="text-sm leading-relaxed text-pretty text-mute">
        Same names as the Grok Build marketplace. Install stays inside this deck.
      </p>
      {list.length === 0 && <p className="text-sm text-paper">No matches.</p>}
      {list.map((plugin) => {
        const flags = flagsFor(plugins, plugin.id);
        const featured = plugin.id === "superpowers";
        return (
          <article
            key={plugin.id}
            className="rounded-xl bg-ink p-4 hair"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base text-paper">{plugin.name}</h3>
              <span className={"shrink-0 text-xs " + (featured ? "text-clay" : "text-mute")}>
                {featured ? "official" : plugin.category}
              </span>
            </div>
            <p className="mt-1 text-xs text-lime">{plugin.spec}</p>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-mute">{plugin.blurb}</p>
            <p className="mt-3 text-xs text-mute">
              {plugin.skills.length} skills
              {plugin.hooks > 0 ? ` · ${plugin.hooks} hook` : ""}
              {plugin.mcp ? " · MCP" : ""}
            </p>
            {featured && !flags.installed && (
              <p className="mt-3 text-sm leading-relaxed text-clay">
                Trust lets the session-start hook run. Official catalog entry, still your call.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!flags.installed && (
                <label className="mr-auto flex h-11 items-center gap-2 text-sm text-paper">
                  <input
                    type="checkbox"
                    className="size-4 accent-lime"
                    checked={Boolean(armed[plugin.id])}
                    onChange={(event) =>
                      setArmed((current) => ({ ...current, [plugin.id]: event.target.checked }))
                    }
                  />
                  --trust
                </label>
              )}
              {!flags.installed && (
                <button
                  type="button"
                  disabled={!armed[plugin.id] || pending === plugin.id}
                  onClick={() => onInstall(plugin.id)}
                  className="h-11 rounded-lg bg-lime px-4 text-sm text-on-lime transition-transform duration-150 ease-out enabled:active:scale-[0.96] disabled:opacity-40"
                >
                  {pending === plugin.id ? "Fetching…" : "Install"}
                </button>
              )}
              {flags.installed && (
                <>
                  <button
                    type="button"
                    onClick={() => setEnabled(plugin.id, !flags.enabled)}
                    className="h-11 rounded-lg px-4 text-sm text-paper hair"
                  >
                    {flags.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    type="button"
                    onClick={() => uninstall(plugin.id)}
                    className="h-11 rounded-md px-3 text-sm text-clay"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Installed() {
  const plugins = useDeck((state) => state.plugins);
  const setEnabled = useDeck((state) => state.setPluginEnabled);
  const uninstall = useDeck((state) => state.uninstallPlugin);
  const setDrawer = useDeck((state) => state.setDrawer);
  const installed = CATALOG.filter((plugin) => flagsFor(plugins, plugin.id).installed);

  if (installed.length === 0) {
    return (
      <Empty
        title="Nothing installed"
        body="The catalog is one command away."
        action="Open marketplace"
        onAction={() => setDrawer("marketplace")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {installed.map((plugin) => {
        const flags = flagsFor(plugins, plugin.id);
        return (
          <li key={plugin.id} className="rounded-xl bg-ink p-4 hair">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-paper">{plugin.name}</p>
                <p className="text-xs text-mute">{flags.trusted ? "trusted" : "untrusted"}</p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(plugin.id, !flags.enabled)}
                className={
                  "h-11 rounded-lg px-4 text-sm " +
                  (flags.enabled ? "bg-lime text-on-lime" : "text-paper hair")
                }
              >
                {flags.enabled ? "On" : "Off"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => uninstall(plugin.id)}
              className="mt-3 h-11 text-sm text-clay"
            >
              Remove {plugin.spec}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Skills() {
  const plugins = useDeck((state) => state.plugins);
  const setDrawer = useDeck((state) => state.setDrawer);
  const rows = useMemo(
    () =>
      CATALOG.flatMap((plugin) => {
        const flags = flagsFor(plugins, plugin.id);
        if (!flags.installed || !flags.enabled) return [];
        return plugin.skills.map((skill) => ({ ...skill, plugin: plugin.name }));
      }),
    [plugins],
  );

  if (rows.length === 0) {
    return (
      <Empty
        title="No skills loaded"
        body="Install a plugin and leave it enabled. Superpowers is the one that changes how code gets written."
        action="Browse catalog"
        onAction={() => setDrawer("marketplace")}
      />
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((skill) => (
        <li key={`${skill.plugin}-${skill.id}`} className="border-b border-line py-3">
          <p className="text-paper">/{skill.id}</p>
          <p className="mt-1 text-sm text-mute">
            {skill.plugin} · {skill.about}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Plan() {
  const plan = useDeck((state) => active(state).plan);
  const focusStep = useDeck((state) => state.focusStep);
  const setMode = useDeck((state) => state.setMode);
  const setDrawer = useDeck((state) => state.setDrawer);

  if (plan.length === 0) {
    return (
      <Empty
        title="No plan yet"
        body="Shift+tab to plan mode and describe the work. This list is the only thing that mode writes."
        action="Switch to plan"
        onAction={() => {
          setMode("plan");
          setDrawer(null);
        }}
      />
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {plan.map((step, index) => (
        <li key={step.title}>
          <button
            type="button"
            onClick={() => focusStep(index)}
            className={
              "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hair " +
              (step.state === "now" ? "bg-raised" : "bg-ink")
            }
          >
            <span
              className={
                "mt-0.5 w-8 shrink-0 text-xs tabular-nums " +
                (step.state === "now" ? "text-lime" : "text-mute")
              }
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm leading-relaxed text-paper">{step.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Models() {
  const model = useDeck((state) => state.model);
  const setModel = useDeck((state) => state.setModel);
  const setDrawer = useDeck((state) => state.setDrawer);

  return (
    <ul className="flex flex-col gap-2">
      {MODELS.map((item) => {
        const on = item.id === model;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setModel(item.id);
                setDrawer(null);
              }}
              className={
                "flex w-full flex-col items-start rounded-xl px-4 py-3 text-left hair " +
                (on ? "bg-raised" : "bg-ink")
              }
            >
              <span className={on ? "text-lime" : "text-paper"}>{item.id}</span>
              <span className="mt-1 text-sm text-mute">{item.note}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Help() {
  const reset = useDeck((state) => state.reset);
  const setDrawer = useDeck((state) => state.setDrawer);

  return (
    <div className="flex flex-col gap-6 text-sm leading-relaxed">
      <section>
        <h3 className="text-xs tracking-wide text-mute uppercase">Keys</h3>
        <ul className="mt-2 flex flex-col gap-2">
          <KeyRow k="Enter" v="Send" />
          <KeyRow k="Shift+Enter" v="New line" />
          <KeyRow k="Shift+Tab" v="Cycle code, plan, ask" />
          <KeyRow k="/" v="Command palette" />
          <KeyRow k="Esc" v="Close the panel" />
          <KeyRow k="Up" v="Previous prompt" />
        </ul>
      </section>
      <section>
        <h3 className="text-xs tracking-wide text-mute uppercase">Projects</h3>
        <p className="mt-2 text-mute">/cd {PROJECTS.join(" · ")}</p>
      </section>
      <section>
        <h3 className="text-xs tracking-wide text-mute uppercase">Imagine</h3>
        <p className="mt-2 text-paper">/imagine a lime trace on a dark olive scope</p>
        <p className="mt-2 text-mute">
          Add a ratio first if you want one: /imagine 16:9 a bench synth. The still shows in the
          transcript. It does not save to your computer.
        </p>
      </section>
      <section>
        <h3 className="text-xs tracking-wide text-mute uppercase">Install line</h3>
        <p className="mt-2 text-paper">grok plugin install superpowers@xai-official --trust</p>
        <p className="mt-2 text-mute">
          Paste it in the prompt. Without --trust the deck stops, same as the CLI.
        </p>
      </section>
      <button
        type="button"
        onClick={() => {
          reset();
          setDrawer(null);
        }}
        className="h-11 self-start rounded-lg px-4 text-clay hair"
      >
        Reset this deck
      </button>
      <p className="text-xs text-mute">
        {pluginById("superpowers")?.spec} is a catalog entry, not a live install on your machine.
      </p>
    </div>
  );
}

function KeyRow({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-line py-2">
      <span className="text-lime">{k}</span>
      <span className="text-paper">{v}</span>
    </li>
  );
}

function Empty({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-xl bg-ink p-4 hair">
      <h3 className="font-serif text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-mute">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 h-11 rounded-lg bg-lime px-4 text-sm text-on-lime transition-transform duration-150 ease-out active:scale-[0.96]"
      >
        {action}
      </button>
    </div>
  );
}
