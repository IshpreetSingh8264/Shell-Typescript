import { spawn } from "child_process";

export function execExternalCommand(
    command: string,
    args: string[],
    stdio: "inherit" | any[] = "inherit",
): Promise<void> {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio,
            argv0: command, // important for correctness
        });

        child.on("error", () => {
            console.error(`${command}: command not found`);
            resolve();
        });

        child.on("exit", () => {
            // Exit code does NOT matter in shells
            resolve();
        });
    });
}
