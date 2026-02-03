# Shell — Design Notes

How the shell is put together, and why. The [README](../README.md) covers what it does; this covers the shape of the
code and the decisions that are not obvious from reading it.

## Contents

- [The four stages](#the-four-stages)
- [Stage 1 — Tokenizer](#stage-1--tokenizer)
- [Stage 2 — Parser](#stage-2--parser)
- [Stage 3 — Dispatcher](#stage-3--dispatcher)
- [Stage 4 — Execution](#stage-4--execution)
- [Support modules](#support-modules)
- [The REPL](#the-repl)
- [Decisions worth explaining](#decisions-worth-explaining)
- [Things deliberately not built](#things-deliberately-not-built)

## The four stages

```
input line
    │
    ▼
┌───────────────────────┐
│ 1  tokenizer.ts       │  characters  →  string[]
│                       │  owns quoting, escaping, comments, $VAR
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 2  parser.ts          │  string[]   →  CommandStructure[]
│                       │  owns pipes, redirects, &
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 3  dispatcher.ts      │  wires stdio, picks built-in vs external,
│                       │  tracks background jobs
└─────┬─────────────┬───┘
      │             │
      ▼             ▼
 built-ins     execExternalCommand.ts
 (registry)         │
                    ▼
                 spawn()
```

There is no separate "command resolver" layer. Path resolution for *execution* is delegated to the OS: `spawn()` is
given a bare command name and the kernel searches `$PATH`. `app/utils/pathCache.ts` exists, but it is used only by the
tab completer, never by the execution path. The `type` built-in does its own inline `$PATH` walk because it needs to
report the resolved path.

## Stage 1 — Tokenizer

`tokenizer(input: string): string[]`

A single-pass character scanner with four pieces of state: `inSingleQuote`, `inDoubleQuote`, `wasQuoted`, and the
current token buffer.

Three things happen here that you might expect to happen later:

1. **Quotes.** `'` is fully literal inside; `"` allows exactly three escapes (`\\`, `\"`, `\$`). Everything else,
   including `$VAR` expansion, is suppressed inside single quotes.
2. **Parameter expansion.** `$NAME` and `${NAME}` are resolved *during tokenization*, before any parsing. This is why an
   expanded value can become the command name (`declare X=ls` then `$X` runs `ls`) and why the expanded characters are
   never re-scanned for operators.
3. **Operators.** Matched longest-first across four lengths, so `2>>` beats `2>` and `>>` beats `>`. The full set:

   | Token | Consumed by the parser? |
   |---|---|
   | `\|` | yes — starts a new pipeline stage |
   | `>`, `1>`, `2>`, `>>`, `1>>`, `2>>` | yes — redirection |
   | `&` | yes — background, last stage only |
   | `&&`, `\|\|`, `;` | **no** — passed through as literal arguments |
   | `<<`, `>&`, `&>`, `<&`, `2>&1`, `<` | **no** — passed through as literal arguments |

   The last two rows are the reason `cat < in.txt` gives `cat` the arguments `<` and `in.txt`. They tokenize cleanly,
   which makes them easy to mistake for supported.

`wasQuoted` exists so that `''` and `""` produce a real empty-string token rather than disappearing. An unterminated
quote throws `Unmatched quote`, which the REPL catches and prints.

## Stage 2 — Parser

`parser(tokens: string[]): CommandStructure[]`

```ts
type Redirection = { fd: 1 | 2; target: string; type: "write" | "append" };
interface CommandStructure {
  command: string;
  args: string[];
  redirections: Redirection[];
  background: boolean;
}
```

The parser does exactly three things:

1. Splits the token list on `|`, producing one `CommandStructure` per stage. The loop is generic, so `a | b | c` works
   without special-casing.
2. Pulls out redirection operators, recording the file descriptor and whether it is `write` or `append`. A missing
   target (`echo hi >`) leaves the operator in the argument list rather than failing — the error then surfaces as
   `>: command not found`, which is roughly what a real shell does.
3. Handles a trailing `&`, but **only on the last stage** and only when it is the final argument. `sleep 1 & echo hi`
   therefore does not background anything; `&` becomes an argument to `sleep`.

## Stage 3 — Dispatcher

`dispatcher(commands: CommandStructure[]): Promise<void>`

Walks the stages in order, carrying `previousStdout` so each stage can read the previous one's output.

- **stdin** — `"inherit"` for the first stage, otherwise the previous stage's `child.stdout` (or `"ignore"` if that
  stage was not a pipe).
- **Redirection** — folded per file descriptor, last one wins.
- **Built-in path** — `console.log` and `console.error` are monkey-patched to write to the target stream, the registry
  entry is awaited, and both are restored in a `finally`. Any non-`process` stream is ended.
- **External path** — `fs.openSync` for each redirect target, raw fds passed to `spawn`, closed in a `finally` once the
  child has `dup`'d them.
- **Background** — the child is `unref()`'d, registered in the job table, and reported as `[n] pid`. Background
  children are not pushed onto the awaited promise list.
- Foreground children are spawned in the loop and awaited together at the end with `Promise.all`.

Parent directories of redirect targets are created recursively before every open. That is a convenience, not POSIX
behaviour.

## Stage 4 — Execution

`execExternalCommand(command, args, stdio, waitForExit)` returns `{ promise, child }`.

- `spawn` is called with the bare command name; the OS resolves `$PATH`.
- A `child.on("error")` prints `command: command not found` and resolves the promise.
- A `child.on("exit")` resolves the promise. **The exit code is deliberately discarded** — a shell does not propagate a
  child's status, and this one also has no `$?`.
- `waitForExit === false` calls `child.unref()` so a background job does not hold the event loop open.

Background is honoured only for external commands. A built-in with `&` runs synchronously and registers no job.

## Support modules

| Module | Owns |
|---|---|
| `utils/history.ts` | the in-memory array, and the append watermark used by `history -a` |
| `utils/jobs.ts` | the job table, id recycling, and the exact `jobs` output format |
| `utils/shellVariables.ts` | `declare` storage and `$VAR` lookup |
| `utils/completions.ts` | the `complete -C` registry and the `spawnSync` call into completion scripts |
| `utils/pathCache.ts` | the `$PATH` scan that feeds command completion |
| `utils/shutdown.ts` | the shutdown request flag, exit code, and hook list |
| `components/completer.ts` | completion candidate selection and the single-tab / double-tab policy |

`app/utils/` is meant to be domain-free leaf code. The one exception is `jobs.ts`, which encodes the exact expected
`jobs` output layout — that is unavoidable given the format is part of the contract.

## The REPL

`app/main.ts` is the part that is easiest to underestimate.

- **Prompt and completion** come from `readline`. The completer is wired in once at construction.
- **HISTFILE** is read once at startup if the variable is set and the file exists. Entries loaded this way are marked
  as already-appended, so `history -a` will not duplicate them.
- **Commands are serialised.** Each `line` event appends to a promise chain rather than running concurrently. Without
  this, readline emits every line of a piped input in a single tick and the async handlers interleave their output.
- **Shutdown** runs registered hooks, sets `process.exitCode`, then closes readline and pauses stdin so the loop
  drains. `process.on('exit', saveHistory)` is registered as a fallback for paths that never reach the shutdown handler.

## Decisions worth explaining

**`exit` does not call `process.exit()`.** It used to, and that reliably lost output: the previous command's stdout
writes were still in flight, and `process.exit()` discarded them. The flag-based shutdown lets the loop finish naturally.

**No `setRawMode` or `emitKeypressEvents` anywhere.** Adding raw mode to implement custom keybindings would silently
break readline's built-in arrow-key history, which the course needs. This is a rule, not an oversight.

**`console` is the built-in output channel.** Monkey-patching is ugly, but it means a built-in gets redirection and
piping for free instead of every built-in having to thread a writer through its signature. The cost is that
`util.format` substitution is unavailable while a built-in runs.

**No backpressure handling on built-in output.** A `PassThrough` is written to with `stream.write()` and the return
value is discarded, so a large built-in output is buffered in memory. Fine at shell scale, wrong for large data.

**The `$PATH` cache never expires.** It is invalidated only when `process.env.PATH` itself changes. A directory added to
`PATH` after the first completion will not be picked up.

**Two dead exports.** `countJobs()` and `hasCompletionSpec()` are defined and never called. Left in place rather than
removed, but worth knowing they are not load-bearing.

## Things deliberately not built

- Input redirection, here-documents, `;`, `&&`, `||`, globbing, command substitution, advanced parameter expansion,
  job control verbs, and the rest of the standard built-in set.

See [Not implemented](../README.md#not-implemented) in the README for the full list. The current course definition has
no stages for any of them, so the tokeniser recognises the characters only to keep them out of ordinary arguments.
