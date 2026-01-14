import { builtInCommands } from "../builtins/builtins";
import type { CommandStructure } from "../types/types";
import { execExternalCommand } from "../utils/execExternalCommand";
import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";

export async function dispatcher(commandStructure: CommandStructure): Promise<void> {
    const { command, args, redirections } = commandStructure;

    if (!command) {
        console.error("Error: No command entered.");
        return;
    }

    if (builtInCommands.hasOwnProperty(command)) {
        let stdoutTarget: string | undefined;
        let stderrTarget: string | undefined;

        for (const r of redirections) {
            if (r.fd === 1) stdoutTarget = r.target;
            if (r.fd === 2) stderrTarget = r.target;
        }

        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;

        const stdoutStream = stdoutTarget ? createWriteStream(stdoutTarget, { flags: "w" }) : undefined;
        const stderrStream = stderrTarget ? createWriteStream(stderrTarget, { flags: "w" }) : undefined;

        if (stdoutTarget) {
            const dir = path.dirname(stdoutTarget);
            fs.mkdirSync(dir, { recursive: true });
        }
        if (stderrTarget) {
            const dir = path.dirname(stderrTarget);
            fs.mkdirSync(dir, { recursive: true });
        }

        if (stdoutStream) {
            console.log = (message?: any, ..._optionalParams: any[]) => {
                stdoutStream.write(`${message ?? ""}\n`);
            };
        }

        if (stderrStream) {
            console.error = (message?: any, ..._optionalParams: any[]) => {
                stderrStream.write(`${message ?? ""}\n`);
            };
        }

        try {
            await builtInCommands[command](args);
        } finally {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            stdoutStream?.end();
            stderrStream?.end();
        }
    } else {
        // Execute external command
        try {
            let stdout: "inherit" | number = "inherit";
            let stderr: "inherit" | number = "inherit";
            const fdsToClose: number[] = [];

            const removeFromCloseList = (fd: number) => {
                const idx = fdsToClose.indexOf(fd);
                if (idx !== -1) fdsToClose.splice(idx, 1);
            };

            const closeFd = (fd: number) => {
                try {
                    fs.closeSync(fd);
                } catch {
                    // ignore
                }
            };

            try {
                for (const r of redirections) {
                    // Create parent directories if needed
                    const dir = path.dirname(r.target);
                    fs.mkdirSync(dir, { recursive: true });
                    
                    const newFd = fs.openSync(r.target, "w");

                    if (r.fd === 1) {
                        if (typeof stdout === "number") {
                            removeFromCloseList(stdout);
                            closeFd(stdout);
                        }
                        stdout = newFd;
                    }

                    if (r.fd === 2) {
                        if (typeof stderr === "number") {
                            removeFromCloseList(stderr);
                            closeFd(stderr);
                        }
                        stderr = newFd;
                    }

                    fdsToClose.push(newFd);
                }

                await execExternalCommand(command, args, ["inherit", stdout, stderr]);
            } finally {
                for (const fd of fdsToClose) {
                    closeFd(fd);
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to execute command: ${error.message}`);
            } else {
                console.error("Failed to execute command: An unknown error occurred.");
            }
        }
    }
}