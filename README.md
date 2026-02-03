# Shell — TypeScript

A POSIX-flavoured command shell written in TypeScript, running on [Bun](https://bun.sh/).

Built for the [CodeCrafters "Build your own Shell"](https://codecrafters.io/challenges/shell) course, then hardened: a
serialised command loop, graceful shutdown that does not truncate in-flight output, background job tracking, and
programmable completion.

> **Scope note.** This is a teaching shell that implements the feature set the course asks for. It is *not* a drop-in
> replacement for `bash` — see [Not implemented](#not-implemented) for the honest list of gaps.

## Contents

- [Quick start](#quick-start)
- [Features](#features)
- [Built-in commands](#built-in-commands)
- [Syntax](#syntax)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Testing](#testing)
- [Not implemented](#not-implemented)
- [Code style](#code-style)

## Quick start

Requires [Bun](https://bun.sh/) 1.2 or newer. There is no build step — TypeScript is executed directly.

```bash
bun install          # only devDependency is @types/bun
./your_program.sh    # builds nothing, just runs the shell
```

Or directly:

```bash
bun run app/main.ts
```

```
$ echo "hello from the shell"
hello from the shell
$ type ls
ls is /usr/bin/ls
$ declare NAME=world && echo $NAME
world
$ echo one two three > out.txt && cat out.txt
one two three
$ sleep 30 &
[1] 4242
$ jobs
[1]+  Running                 sleep 30 &
```

## Features

**Command execution**
- Nine built-in commands, dispatched from a registry object.
- Any executable on `$PATH`, spawned directly — no wrapper shell in between.
- Multi-stage pipelines (`a | b | c`) with real OS pipes between external commands.
- Background jobs with `&`, a job table, and reaping on prompt return.

**Redirection**

| Form | Effect |
|---|---|
| `>` / `1>` | truncate stdout to a file |
| `>>` / `1>>` | append stdout to a file |
| `2>` | truncate stderr to a file |
| `2>>` | append stderr to a file |

Redirection targets are created with their parent directories, so `> out/nested/file.txt` works.

**Quoting and expansion**
- Single quotes (fully literal), double quotes (selective escapes, variable expansion active), and backslash escaping
  outside quotes.
- `$VAR` and `${VAR}` expansion, with POSIX-style word splitting when unquoted.
- `#` comments when `#` starts a word.
- Unterminated quotes are reported rather than silently swallowed.

**Completion**
- Command-name completion over built-ins plus `$PATH` executables.
- Filename completion, including nested paths and directories (with a trailing `/`).
- Longest-common-prefix completion on a single tab; sorted candidate list on repeated tabs; a bell when there is no
  unique match.
- Programmable completion: `complete -C <script> <command>` runs an external script and reads candidates from its
  stdout, with `COMP_LINE` and `COMP_POINT` exported.

**History**
- In-memory history, plus persistence to `$HISTFILE` when that variable is set.
- `history`, `history N`, `history -r FILE`, `history -w FILE`, `history -a FILE`.
- Arrow-key recall comes free from `readline` — there is deliberately no `setRawMode` in this codebase, because it
  would break it.

**Robustness**
- Commands are serialised through a promise chain, so piped input cannot interleave output from concurrent commands.
- `exit` requests shutdown and lets the event loop drain, instead of calling `process.exit()` and discarding buffered
  stdout.

## Built-in commands

| Command | Description |
|---|---|
| `cd [dir]` | Change directory. Bare `~` and no-argument (→ `$HOME`) are supported. |
| `complete -C SCRIPT CMD` | Register a programmable completion script for `CMD`. |
| `complete -p CMD...` | Print the completion specification registered for `CMD`. |
| `complete -r CMD...` | Remove a completion specification. |
| `declare NAME=VALUE` | Set a shell variable. |
| `declare -p NAME...` | Print `declare -- NAME="VALUE"` for each variable. |
| `echo [args...]` | Print arguments joined by a space. |
| `exit [code]` | Request shutdown with an exit code (default `0`). |
| `history [N]` | Print all history, or the last `N` entries. |
| `history -r FILE` | Read history from `FILE`. |
| `history -w FILE` | Rewrite `FILE` with the entire history. |
| `history -a FILE` | Append only entries not previously appended. |
| `jobs` | List background jobs and their state. |
| `pwd` | Print the working directory. |
| `type NAME` | Report whether `NAME` is a built-in, and if not, its full path on `$PATH`. |

`declare` variables live in a `Map` inside `app/utils/shellVariables.ts`, deliberately *not* in `process.env`, so that
`declare -p` can print a shell-style declaration rather than `declare -x`.

## Syntax

The tokenizer is a single-pass character scanner. Operator matching is longest-first, so `2>>` is never mistaken for
`2>` followed by `>`.

```bash
echo 'single quotes: $NOT_EXPANDED \n | > # all literal'
echo "double quotes: $EXPANDED, escapes are \\ \" \$ only"
echo escaped\ space          # one argument: "escaped space"
echo $HOME/sub              # expands, then concatenates
echo a$UNSET                # "a" — the word survives even though the variable is empty
```

Inside double quotes the only recognised escapes are `\\`, `\"` and `\$`. Any other `\X` is kept literally, which is
POSIX behaviour but worth knowing.

Unquoted expansion splits on whitespace and drops empty fields. A word consisting *only* of an unset variable
disappears; a word with a literal prefix (`a$UNSET`) does not.

## Architecture

```
stdin ──► readline (prompt, completion, arrow keys)
            │
            ▼
          tokenizer ──► parser ──► dispatcher ──┬──► built-in registry
          (quoting,     (pipes,   (stdio      │
           expansion,   redirects, wiring)     └──► spawn() → external process
           operators)   & jobs)
```

Four functions carry the whole design, and each lives in its own file:

| Stage | File | Responsibility |
|---|---|---|
| Tokenizer | `app/components/tokenizer.ts` | Characters → tokens. Owns quoting, escaping, comments, and `$VAR` expansion. |
| Parser | `app/components/parser.ts` | Tokens → `CommandStructure[]`, one per pipeline stage. Owns redirection and `&`. |
| Dispatcher | `app/components/dispatcher.ts` | Wires stdio, runs built-ins or spawns processes, tracks jobs. |
| Executor | `app/utils/execExternalCommand.ts` | `spawn()` wrapper; returns `{ promise, child }`. |

Two decisions are worth calling out because they are easy to get wrong:

**Built-ins are routed through `console.log` / `console.error`.** The dispatcher monkey-patches both for the duration of
a built-in call so that redirection and piping work uniformly whether the command is built in or external, then
restores them in a `finally`. A consequence: `util.format`-style `%s` substitution is unavailable while a built-in runs.

**`exit` does not call `process.exit()`.** It sets a flag via `app/utils/shutdown.ts`; the main loop notices, runs the
registered shutdown hooks (currently: save history), sets `process.exitCode`, and closes readline so the event loop
drains naturally. Calling `process.exit()` directly used to lose whatever the previous command was still writing.

## Project layout

```
app/
  main.ts                     REPL, prompt, history load/save, shutdown
  builtins/builtins.ts        the built-in command registry
  components/
    tokenizer.ts              characters → tokens
    parser.ts                 tokens → pipeline stages
    dispatcher.ts             execution and stdio wiring
    completer.ts              tab completion policy
  types/types.ts              CommandStructure, Redirection
  utils/
    completions.ts            programmable completion registry
    execExternalCommand.ts    spawn() wrapper
    history.ts                in-memory history
    jobs.ts                   background job table
    pathCache.ts              $PATH scan for completion
    shellVariables.ts         declare / $VAR storage
    shutdown.ts               graceful shutdown protocol
docs/design.md                design notes
your_program.sh               local run script
```

## Testing

There is no automated test suite in this repository — tab completion and history navigation in particular need a real
pty, so they are exercised manually. The graded check is the CodeCrafters tester, which runs remotely:

```bash
codecrafters test
```

To drive the shell by hand, run it under a terminal rather than a pipe; piped stdin does not trigger completion or
arrow-key history.

## Not implemented

Deliberately out of scope, listed so the gaps are explicit:

- **Input redirection** (`< file`) and here-documents (`<<`). These tokenize but are not consumed by the parser, so they
  end up as literal arguments.
- **Operators** `;`, `&&`, `||`. Tokenized, never executed.
- **Globbing** — `*`, `?`, `[...]`, `~` expansion, brace expansion. `echo *.ts` prints `*.ts`.
- **Command substitution** — `$(...)`, backticks, `$'...'`.
- **Advanced parameter expansion** — `${VAR:-default}`, `${#VAR}`, `${VAR/pat/rep}`. Positional parameters (`$1`, `$@`)
  and `$?` are printed literally.
- **Job control** — `fg`, `bg`, `kill`, `wait`, `%1` specs.
- **`export`, `unset`, `env`, `alias`**, and the rest of the usual built-in set.

## Code style

Comments in the source are written in Pinglish — Punjabi in Latin script, with an English gloss in parentheses. It is the
consistent voice of this project and is worth preserving when you edit.

```ts
// Oye, redirection da target pehlan hi bana dena, taaki missing folder na rok laye
fs.mkdirSync(path.dirname(target), { recursive: true });
```

## Licence

No licence file is present in this repository. Add one before redistributing.
