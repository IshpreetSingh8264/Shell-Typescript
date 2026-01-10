import { spawn } from "child_process";

export function execExternalCommand(
    command: string,
    args: string[]
): Promise<void> {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            argv0: command, // important: argv[0] is the user-typed command
        });

        child.on("error", (err) => {
            // This happens if command does not exist or is not executable
            console.error(`${command}: ${err.message}`);
            resolve();
        });

        child.on("exit", () => {
            // Exit codes are NOT errors in shells
            resolve();
        });
    });
}
