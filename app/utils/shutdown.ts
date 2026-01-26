/**
 * Graceful-shutdown protocol.
 *
 * Why this file exists: `exit` is a builtin (a registry entry in
 * `builtins/builtins.ts`) but shutting the shell down is the REPL's job
 * (`main.ts`). Letting `exit` call `process.exit(0)` directly meant the
 * in-flight `stdout` writes of the *previous* command were thrown away:
 *
 *     printf 'echo redir > /tmp/race.txt\nexit\n' | bun run app/main.ts
 *     cat /tmp/race.txt   ->  No such file or directory
 *
 * `process.exit()` does not wait for async I/O. So instead of exiting, `exit`
 * *requests* a shutdown; `main.ts` observes that request, runs the registered
 * hooks, and then stops the event loop from being held open so the process ends
 * on its own with a fully flushed stdout.
 *
 * This module holds the shared state so the layers stay unidirectional:
 * `builtins -> utils.shutdown <- main` (no back-references, no cycles).
 */

type ShutdownHook = () => void | Promise<void>;

const hooks: ShutdownHook[] = [];

let requested = false;
let exitCode = 0;

/** Register work that must finish before the process is allowed to end. */
export function onShutdown(hook: ShutdownHook): void {
    hooks.push(hook);
}

/** True once `exit` (or anything else) has asked the shell to stop. */
export function isShutdownRequested(): boolean {
    return requested;
}

export function requestShutdown(code = 0): void {
    requested = true;
    exitCode = code;
}

export function getExitCode(): number {
    return exitCode;
}

/**
 * Runs every hook in registration order. A failing hook must not stop the rest,
 * otherwise one unwritable HISTFILE would leave the shell hanging.
 */
export async function runShutdownHooks(): Promise<void> {
    for (const hook of hooks) {
        try {
            await hook();
        } catch {
            // Best effort - the process is going away regardless.
        }
    }
}
