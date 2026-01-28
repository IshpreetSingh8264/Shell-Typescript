import { getHistory, addToHistory, getNewHistory, markHistoryAsAppended } from "../utils/history";
import { getVariable, hasVariable, isValidIdentifier, setVariable } from "../utils/shellVariables";
import { reapForListing } from "../utils/jobs";
import { requestShutdown } from "../utils/shutdown";
import fs from "fs";

export const builtInCommands: { [key: string]: (args: string[]) => void | Promise<void> } = {
    echo: (args: string[]) => {
        console.log(args.join(" "));
    },
    exit: (args: string[]) => {
        // Request a graceful shutdown; main.ts performs it once the current
        // command's output has drained. Calling process.exit() here would
        // discard in-flight async writes.
        const parsed = args.length > 0 ? Number.parseInt(args[0], 10) : 0;
        requestShutdown(Number.isNaN(parsed) ? 0 : parsed);
    },
    history: (args: string[]) => {
        if (args.length > 0 && args[0] === '-r') {
            const path = args[1];
            if (path) {
                try {
                    const content = fs.readFileSync(path, 'utf-8');
                    const lines = content.split('\n');
                    for (const line of lines) {
                        addToHistory(line);
                    }
                } catch (e) {
                    // Fail silently or log error? Standard shell might complain if file not found but prompt doesn't specify.
                    // But for debugging let's log if it's not ENOENT maybe?
                    // The prompt says "Read history from file".
                    // If file doesn't exist, usually history -r does nothing or complains.
                    // I'll log error for now as it helps debugging.
                    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                         console.error(`history: ${path}: ${(e as Error).message}`);
                    }
                }
            }
            return;
        }

        if (args.length > 0 && args[0] === '-w') {
            const path = args[1];
            if (path) {
                try {
                    const hist = getHistory();
                    fs.writeFileSync(path, hist.join('\n') + '\n');
                } catch (e) {
                    console.error(`history: ${path}: ${(e as Error).message}`);
                }
            }
            return;
        }

        if (args.length > 0 && args[0] === '-a') {
            const path = args[1];
            if (path) {
                try {
                    const newHist = getNewHistory();
                    if (newHist.length > 0) {
                        fs.appendFileSync(path, newHist.join('\n') + '\n');
                        markHistoryAsAppended();
                    }
                } catch (e) {
                    console.error(`history: ${path}: ${(e as Error).message}`);
                }
            }
            return;
        }

        const hist = getHistory();
        let startIndex = 0;

        if (args.length > 0) {
            const n = parseInt(args[0], 10);
            if (!isNaN(n) && n > 0) {
                startIndex = Math.max(0, hist.length - n);
            }
        }

        for (let i = startIndex; i < hist.length; i++) {
            console.log(`    ${i + 1}  ${hist[i]}`);
        }
    },
    jobs: () => {
        // Reaping happens here too, so a job that already exited is reported
        // as Done exactly once - by `jobs` or by the pre-prompt hook, whichever
        // comes first.
        for (const line of reapForListing()) {
            console.log(line);
        }
    },
    declare: (args: string[]) => {
        const print = args[0] === "-p";

        if (print) {
            for (const name of args.slice(1)) {
                if (!hasVariable(name)) {
                    console.error(`declare: ${name}: not found`);
                    continue;
                }
                console.log(`declare -- ${name}="${getVariable(name)}"`);
            }
            return;
        }

        for (const arg of args) {
            // Split on the first '=' only: a value may itself contain '='.
            const eq = arg.indexOf("=");
            const name = eq === -1 ? arg : arg.slice(0, eq);
            const value = eq === -1 ? "" : arg.slice(eq + 1);

            if (!isValidIdentifier(name)) {
                console.error(`declare: \`${arg}': not a valid identifier`);
                continue;
            }

            setVariable(name, value);
        }
    },
    pwd:()=>{
        console.log(process.cwd());
    },
    cd: (args: string[]) => {
        // `cd` with no argument goes home, like every other shell.
        const dir = args.length > 0 ? args[0] : process.env.HOME;
        if (!dir) {
            console.error("cd: HOME not set");
            return;
        }
        try {
            if (dir === "~") {
                process.chdir(process.env.HOME || "");
            } else {
                process.chdir(dir);
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                console.error(`cd: ${dir}: No such file or directory`);
            } else {
                console.error(`cd: ${dir}: ${(error as Error).message}`);
            }
        }
    },
    type:(args:string[])=>{
        const command = args[0];
        if (builtInCommands.hasOwnProperty(command)) {
            console.log(`${command} is a shell builtin`);
            return;
        }
        const PATH = process.env.PATH || "";
        const directories = PATH.split(require('path').delimiter);
        const fs = require('fs');
        const path = require('path');
        for (const dir of directories) {
            const fullPath = path.join(dir, command);
            try {
                fs.accessSync(fullPath, fs.constants.X_OK);
                console.log(`${command} is ${fullPath}`);
                return;
            } catch {}
        }
        console.log(`${command}: not found`);
    },
};