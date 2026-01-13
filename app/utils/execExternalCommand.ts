import { spawn } from "child_process";
import type { Writable } from "stream";

export function execExternalCommand(command: string,args: string[],outputStream?: Writable): Promise<void> {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio: outputStream
                ? ["inherit", "pipe", "inherit"] // stdout redirected
                : "inherit",
            argv0: command, // important for correctness
        });

        if (outputStream && child.stdout) {
            child.stdout.pipe(outputStream);
        }

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
