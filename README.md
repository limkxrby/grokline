# Grokline

A browser deck for a Grok-style terminal.

- **Deck** switches between code, plan, and ask. Prompts are answered by Grok.
- **Imagine** makes stills from a description, or from `/imagine` in the deck.
- Asking Code mode to create a game runs a playable preview in the transcript instead of pasting a source listing.

## Run

```bash
npm install
```

Export `XAI_API_KEY` in your environment. Do not commit it.

```bash
npm run dev
```

This does not install the real `grok` CLI, and it does not edit files on your computer.
