import { builtInCommands } from "../builtins/builtins";
import type { CommandStructure, Redirection } from "../types/types";
import { execExternalCommand } from "../utils/execExternalCommand";
import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";

export async function dispatcher(commands: CommandStructure[]): Promise<void> {
    if (commands.length === 0) return;

    if (commands.length === 1) {
        await dispatchSingleCommand(commands[0]);
        return;
    }

    let previousStdout: any = "inherit";
    const promises: Promise<void>[] = [];

    for (let i = 0; i < commands.length; i++) {
        const cmdStruct = commands[i];
        const isLast = i === commands.length - 1;
        
        if (builtInCommands.hasOwnProperty(cmdStruct.command)) {
             await dispatchSingleCommand(cmdStruct);
             previousStdout = null; 
             continue;
        }

        let stdout: any = "inherit";
        if (!isLast) {
            stdout = "pipe";
        }
        
        let stderr: any = "inherit";
        
        let spawnStdin: any = "inherit";
        let inputStreamToPipe: any = null;

        if (previousStdout === null) {
            spawnStdin = "ignore";
        } else if (typeof previousStdout !== "string") {
            spawnStdin = "pipe";
            inputStreamToPipe = previousStdout;
        } else {
            spawnStdin = previousStdout;
        }

        const fdsToClose: number[] = [];
        
        const closeFd = (fd: number) => {
            try { fs.closeSync(fd); } catch {}
        };

        try {
            for (const r of cmdStruct.redirections) {
                const dir = path.dirname(r.target);
                fs.mkdirSync(dir, { recursive: true });
                
                const flags = r.type === "append" ? "a" : "w";
                const newFd = fs.openSync(r.target, flags);
                fdsToClose.push(newFd);

                if (r.fd === 1) stdout = newFd;
                if (r.fd === 2) stderr = newFd;
            }

            const { promise, child } = execExternalCommand(cmdStruct.command, cmdStruct.args, [spawnStdin, stdout, stderr]);
            promises.push(promise);

            if (inputStreamToPipe && child.stdin) {
                inputStreamToPipe.pipe(child.stdin);
            }

            if (!isLast) {
                previousStdout = child.stdout;
            }
        } catch (err) {
             console.error(`Error setting up command ${cmdStruct.command}:`, err);
        } finally {
             for (const fd of fdsToClose) {
                 closeFd(fd);
             }
        }
    }
    
    await Promise.all(promises);
}

async function dispatchSingleCommand(commandStructure: CommandStructure): Promise<void> {
    const { command, args, redirections } = commandStructure;

    if (!command) {
        console.error("Error: No command entered.");
        return;
    }

    if (builtInCommands.hasOwnProperty(command)) {
        let stdoutTarget: { path: string, mode: "write" | "append" } | undefined;
        let stderrTarget: { path: string, mode: "write" | "append" } | undefined;

        for (const r of redirections) {
            if (r.fd === 1) stdoutTarget = { path: r.target, mode: r.type };
            if (r.fd === 2) stderrTarget = { path: r.target, mode: r.type };
        }

        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;

        const stdoutStream = stdoutTarget ? createWriteStream(stdoutTarget.path, { flags: stdoutTarget.mode === "append" ? "a" : "w" }) : undefined;
        const stderrStream = stderrTarget ? createWriteStream(stderrTarget.path, { flags: stderrTarget.mode === "append" ? "a" : "w" }) : undefined;

        if (stdoutTarget) {
            const dir = path.dirname(stdoutTarget.path);
            fs.mkdirSync(dir, { recursive: true });
        }
        if (stderrTarget) {
            const dir = path.dirname(stderrTarget.path);
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
                    const dir = path.dirname(r.target);
                    fs.mkdirSync(dir, { recursive: true });
                    
                    const flags = r.type === "append" ? "a" : "w";
                    const newFd = fs.openSync(r.target, flags);

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

                const { promise } = execExternalCommand(command, args, ["inherit", stdout, stderr]);
                await promise;
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
