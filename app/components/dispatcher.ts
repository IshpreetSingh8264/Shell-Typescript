import { builtInCommands } from "../builtins/builtins";
import type { CommandStructure } from "../types/types";
import { execExternalCommand } from "../utils/execExternalCommand";
import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";
import { PassThrough, Readable, Writable } from "stream";

export async function dispatcher(commands: CommandStructure[]): Promise<void> {
    let previousStdout: Readable | null = null;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < commands.length; i++) {
        const cmdStruct = commands[i];
        const isLast = i === commands.length - 1;
        
        // Determine Input
        let stdinStream: Readable | "ignore" | "inherit" = "inherit";
        if (i > 0) {
            stdinStream = previousStdout || "ignore";
        }

        // Determine Output
        const pipingToNext = !isLast;
        
        // Check for redirections
        let stdoutTarget: { path: string, mode: "write" | "append" } | undefined;
        let stderrTarget: { path: string, mode: "write" | "append" } | undefined;

        for (const r of cmdStruct.redirections) {
            if (r.fd === 1) stdoutTarget = { path: r.target, mode: r.type };
            if (r.fd === 2) stderrTarget = { path: r.target, mode: r.type };
        }

        if (builtInCommands.hasOwnProperty(cmdStruct.command)) {
            // Builtin Command
            
            // Handle Input (Drain if exists, as builtins don't use it yet)
            if (stdinStream instanceof Readable) {
                stdinStream.resume();
            }

            // Handle Output
            let stdoutStream: Writable = process.stdout;
            let stderrStream: Writable = process.stderr;
            let nextInput: Readable | null = null;

            // If piping to next and no explicit redirection, create a pass-through
            if (pipingToNext && !stdoutTarget) {
                const pass = new PassThrough();
                stdoutStream = pass;
                nextInput = pass;
            } else if (stdoutTarget) {
                // File redirection
                const dir = path.dirname(stdoutTarget.path);
                fs.mkdirSync(dir, { recursive: true });
                stdoutStream = createWriteStream(stdoutTarget.path, { flags: stdoutTarget.mode === "append" ? "a" : "w" });
                
                if (pipingToNext) {
                    // If redirected to file, pipe gets nothing (empty stream)
                    const pass = new PassThrough();
                    pass.end();
                    nextInput = pass;
                }
            }

            if (stderrTarget) {
                const dir = path.dirname(stderrTarget.path);
                fs.mkdirSync(dir, { recursive: true });
                stderrStream = createWriteStream(stderrTarget.path, { flags: stderrTarget.mode === "append" ? "a" : "w" });
            }

            // Monkey patch console
            const originalLog = console.log;
            const originalError = console.error;

            console.log = (...args: any[]) => {
                stdoutStream.write(args.join(" ") + "\n");
            };
            console.error = (...args: any[]) => {
                stderrStream.write(args.join(" ") + "\n");
            };

            try {
                await builtInCommands[cmdStruct.command](cmdStruct.args);
            } catch (e) {
                console.error(e);
            } finally {
                console.log = originalLog;
                console.error = originalError;
                
                if (stdoutStream !== process.stdout && stdoutStream instanceof Writable) {
                     stdoutStream.end();
                }
                if (stderrStream !== process.stderr && stderrStream instanceof Writable) {
                     stderrStream.end();
                }
            }
            
            previousStdout = nextInput;

        } else {
            // External Command
            
            let stdout: any = "inherit";
            let stderr: any = "inherit";
            const fdsToClose: number[] = [];

            // Handle Output Redirection
            if (stdoutTarget) {
                const dir = path.dirname(stdoutTarget.path);
                fs.mkdirSync(dir, { recursive: true });
                const flags = stdoutTarget.mode === "append" ? "a" : "w";
                const fd = fs.openSync(stdoutTarget.path, flags);
                stdout = fd;
                fdsToClose.push(fd);
            } else if (pipingToNext) {
                stdout = "pipe";
            }

            // Handle Stderr Redirection
            if (stderrTarget) {
                const dir = path.dirname(stderrTarget.path);
                fs.mkdirSync(dir, { recursive: true });
                const flags = stderrTarget.mode === "append" ? "a" : "w";
                const fd = fs.openSync(stderrTarget.path, flags);
                stderr = fd;
                fdsToClose.push(fd);
            }

            // Input
            let spawnStdin: any = stdinStream;
            let inputStreamToPipe: Readable | null = null;

            if (stdinStream instanceof Readable) {
                spawnStdin = 'pipe';
                inputStreamToPipe = stdinStream;
            }

            try {
                const { promise, child } = execExternalCommand(cmdStruct.command, cmdStruct.args, [spawnStdin, stdout, stderr]);
                
                if (inputStreamToPipe && child.stdin) {
                    inputStreamToPipe.pipe(child.stdin);
                }

                promises.push(promise);
                
                if (pipingToNext) {
                    if (stdout === "pipe") {
                        previousStdout = child.stdout;
                    } else {
                        // Redirected to file, so next command gets empty input
                        const pass = new PassThrough();
                        pass.end();
                        previousStdout = pass;
                    }
                }
            } catch (err) {
                console.error(`Error starting ${cmdStruct.command}:`, err);
            } finally {
                for (const fd of fdsToClose) {
                    try { fs.closeSync(fd); } catch {}
                }
            }
        }
    }

    await Promise.all(promises);
}
