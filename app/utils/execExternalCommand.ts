import { spawn } from "child_process";
import type { Writable } from "stream";

export async function execExternalCommand(
    command: string,
    args: string[],
    outputStream?: Writable
): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: outputStream ? ["inherit", "pipe", "inherit"] : "inherit",
            shell: true,
        });

        if (outputStream) {
            if (child.stdout) {
                child.stdout.pipe(outputStream); // Redirect stdout to the output stream
            }
        }

        child.on("error", () => {
            console.error(`${command}: command not found`);
            resolve();
        });

        child.on("close", (code) => {
            if (code !== 0) {
                resolve();
            } else {
                resolve();
            }
        });
    });
}