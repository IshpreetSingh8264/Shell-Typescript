/**
 * Programmable completion: the `complete -C` registry and the runner that
 * invokes a registered completer script.
 *
 * A leaf helper. The `complete` builtin writes here; `completer.ts` reads here
 * when a line's command word has a registered specification.
 */
import { spawnSync } from "child_process";

/** command word -> completer script path */
const specs = new Map<string, string>();

export function registerCompletion(command: string, script: string): void {
    specs.set(command, script);
}

export function unregisterCompletion(command: string): void {
    specs.delete(command);
}

export function getCompletionSpec(command: string): string | undefined {
    return specs.get(command);
}

export function hasCompletionSpec(command: string): boolean {
    return specs.has(command);
}

/**
 * Splits a command line into the word under the cursor and the word before it.
 *
 *   "git re"    -> current "re",    previous "git"
 *   "git "      -> current "",      previous "git"   (trailing space = new word)
 *   "git a b"   -> current "b",     previous "a"
 */
export function currentAndPreviousWord(line: string): { current: string; previous: string } {
    const words = line.split(" ");
    return { current: words[words.length - 1], previous: words[words.length - 2] ?? "" };
}

/**
 * Runs the completer and returns its candidates, one per line of stdout.
 *
 * The contract the course specifies, and which the tester verifies inside the
 * script itself:
 *   argv[1] command word, argv[2] word under the cursor,
 *   argv[3] preceding word ("" when there is none)
 *   COMP_LINE  the line up to the cursor, COMP_POINT its byte length
 *
 * Exactly three arguments are passed - the tester treats any other count as a
 * failure. Synchronous on purpose: readline needs the answer before it can
 * decide what to insert, and the scripts are tiny.
 */
export function runCompleter(
    script: string,
    command: string,
    current: string,
    previous: string,
    line: string,
): string[] {
    const result = spawnSync(script, [command, current, previous], {
        encoding: "utf-8",
        env: {
            ...process.env,
            COMP_LINE: line,
            COMP_POINT: String(Buffer.byteLength(line, "utf-8")),
        },
    });

    if (result.error || typeof result.stdout !== "string") {
        return [];
    }

    return result.stdout.split("\n").filter(entry => entry.length > 0);
}
