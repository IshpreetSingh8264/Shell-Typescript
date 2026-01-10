export const builtInCommands: { [key: string]: (args: string[]) => void | Promise<void> } = {
    echo: (args: string[]) => {
        console.log(args.join(" "));
    },
    exit: () => {
        console.log("Exiting shell...");
        process.exit(0);
    },
    pwd:()=>{
        console.log(process.cwd());
    },
    cd: (args: string[]) => {
        const dir = args[0];
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