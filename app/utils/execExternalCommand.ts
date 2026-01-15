import { spawn, ChildProcess } from "child_process";

export function execExternalCommand(
    command: string,
    args: string[],
    stdio: "inherit" | any[] = "inherit",
): { promise: Promise<void>, child: ChildProcess } {
    const child = spawn(command, args, {
        stdio,
        argv0: command, // important for correctness
    });

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
