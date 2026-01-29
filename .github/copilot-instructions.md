# Copilot Instructions for Codecrafters Shell (TypeScript)

Guidance for AI agents working in this codebase. This shell is the reference
architecture for the other six CodeCrafters projects, so read this before
restructuring anything.

## Project Overview

A POSIX-ish shell in TypeScript, built as the Codecrafters "Build your own
Shell" challenge. It runs a REPL, tokenizes and parses input, runs builtins and
external programs, and supports pipes, redirection, tab completion, history and
background jobs.

## Key Components

| File | Role |
|---|---|
| `app/main.ts` | Entry point. Wires the REPL together and holds no domain logic. |
| `app/components/tokenizer.ts` | Line -> tokens. Quoting, escaping, operator splitting, `$VAR` expansion. |
| `app/components/parser.ts` | Tokens -> `CommandStructure[]`. Splits on `\|`, extracts redirections and a trailing `&`. |
| `app/components/dispatcher.ts` | Runs commands. Owns pipes, redirection, fd lifetime, and background spawns. |
| `app/components/completer.ts` | Tab completion. Turns candidates into what readline should insert. |
| `app/builtins/builtins.ts` | The builtin registry: one key per command. |
| `app/utils/` | Leaf helpers with no domain knowledge: history, jobs, shell variables, completions, path cache, process spawn, shutdown. |
| `app/types/types.ts` | Shared contracts. No logic. |

## Data flow

```
stdin -> tokenizer -> parser -> dispatcher -> builtins | execExternalCommand
```

Each layer only calls the layer below it. `parser` never calls `dispatcher`; they
exchange a `CommandStructure[]`. `utils/*` sit underneath and are called by
anyone. Nothing calls back up.

## Conventions

1. **A new builtin is one registry key** in `builtins/builtins.ts`. Never add an
   `if`/`switch` to the dispatcher.
2. **Every builtin has the signature `(args: string[]) => void | Promise<void>`.**
3. **One layer owns cross-cutting concerns.** The dispatcher owns pipes, fds and
   redirection; builtins just call `console.log` and know nothing about them.
   The dispatcher monkey-patches `console.log`/`console.error` for the duration
   of a builtin and restores them in `finally`.
4. **One concept per file, small files.** If a file approaches 200 lines, that is
   a signal to extract a helper.
5. **Strongly typed.** Shared types live in `app/types/types.ts`.

### How to add a builtin

1. Write the handler in `app/builtins/builtins.ts`:
   ```ts
   mycmd: (args: string[]) => {
       console.log(args.join(" "));
   },
   ```
2. Done. `type`, tab completion and dispatch pick it up automatically, because
   both read `Object.keys(builtInCommands)`.

### How to add a tab-completion source

Add a function in `completer.ts` that returns `{ candidates, partial }`, then
hand it to `resolveCandidates()`. Do not re-implement the LCP / bell / list
logic - that behaviour is shared on purpose so the three sources cannot drift.

## Integration points

- **External commands**: `utils/execExternalCommand.ts` via `child_process.spawn`,
  with `argv0` set to the command as typed. `waitForExit: false` spawns a
  background job and unrefs it.
- **Completer scripts**: `utils/completions.ts` runs them with `spawnSync`,
  passing exactly three argv and `COMP_LINE` / `COMP_POINT`.
- **Environment**: `HISTFILE` is read on startup and rewritten on exit.

## Gotchas - read before changing completion or history

These are non-obvious and were each verified against the CodeCrafters tester
(`codecrafters-io/shell-tester`). Breaking one of them fails specific stages.

- **The BEL character `\x07` is required, not a stray byte.** Stages
  `qm8`/`vs5` ("Missing completions") and `wh6`/`no5`/`bf8` (multiple matches)
  assert it with `assertions.BellAssertion`. Every "nothing to offer" and
  "press TAB again" path in `completer.ts` must write it.
- **Do not add raw-mode key handling for history.** Node/Bun `readline` already
  implements up-arrow and down-arrow history recall and redraws in place. Stages
  `vq0` and `dm2` pass because of that, with no shell code at all. Adding
  `setRawMode` / `emitKeypressEvents` handlers on top of it will fight readline
  and break line editing.
- **A background job is a direct child of the shell.** Stages check the printed
  PID is among the shell's descendants, so do not wrap it in an extra shell.
- **`jobs` line format is exact**: `[n]<marker>  <status>` then 17 spaces, then
  the command, plus a trailing ` &` **only** for `Running` entries. Markers are
  computed against the list *before* finished jobs are removed, and job numbers
  recycle (an empty table restarts at 1).
- **Never call `process.exit()`.** It discards in-flight async writes, so a
  redirect followed by `exit` loses its output. `exit` calls
  `utils/shutdown.requestShutdown()`; `main.ts` then runs the shutdown hooks and
  releases readline/stdin so the process ends with a flushed stdout.
- **The `rl.on("line")` handler is chained onto a promise.** readline emits every
  line of a pipe in one tick, so an `async` handler would run commands
  concurrently and interleave their output.

## Testing

- Run locally with `./your_program.sh` or `bun run app/main.ts`.
- `codecrafters test` runs the current stage and all previous ones.
- Behaviour is checked with a pty, because the terminal echoes typed input and
  the completion stages assert on screen rows. Piped-stdin runs do not exercise
  tab completion or history navigation.
