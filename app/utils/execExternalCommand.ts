import { spawn, ChildProcess } from "child_process";

export function execExternalCommand(
    command: string,
    args: string[],
    stdio: "inherit" | any[] = "inherit",
    // Background jobs must not be awaited - that is the whole point of `&`.
    waitForExit = true,
): { promise: Promise<void>, child: ChildProcess } {
    const child = spawn(command, args, {
        stdio,
        argv0: command, // important for correctness
    });

    if (!waitForExit) {
        // Nothing else may be holding the event loop open on this child's
        // behalf, or the shell would refuse to exit while a job still runs.
        // The 'exit' listener installed by addJob() still fires.
        child.unref();
    }

    const promise = new Promise<void>((resolve) => {
        child.on("error", () => {
            console.error(`${command}: command not found`);
            resolve();
        });

        child.on("exit", () => {
            // Exit code does NOT matter in shells
            resolve();
        });
    });

    return { promise, child };
}
