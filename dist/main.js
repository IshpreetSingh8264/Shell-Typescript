import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// app/main.ts
import { createInterface } from "readline";

// app/components/tokenizer.ts
function tokenizer(input) {
  const tokens = [];
  let currentToken = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;
  let wasQuoted = false;
  const operators = new Set(["&&", "||", ";", "|", "&"]);
  const redirectOps = new Set(["<<", ">>", ">&", "&>", "<&", "2>&1", "2>", "1>", "1>>", "2>>"]);
  while (i < input.length) {
    const char = input[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      wasQuoted = true;
      i++;
      continue;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      wasQuoted = true;
      i++;
      continue;
    } else if (char === "\\" && !inSingleQuote) {
      if (inDoubleQuote) {
        if (i + 1 < input.length && ["\\", '"', "$"].includes(input[i + 1])) {
          currentToken += input[i + 1];
          i += 2;
          continue;
        }
      } else {
        if (i + 1 < input.length) {
          currentToken += input[i + 1];
          i += 2;
          continue;
        }
      }
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (/\s/.test(char)) {
        if (currentToken.length > 0 || wasQuoted) {
          tokens.push(currentToken);
          currentToken = "";
          wasQuoted = false;
        }
        i++;
        continue;
      } else if (char === "#" && currentToken.length === 0 && (i === 0 || /\s/.test(input[i - 1]))) {
        break;
      } else {
        const fourCharOp = input.slice(i, i + 4);
        const threeCharOp = input.slice(i, i + 3);
        const twoCharOp = input.slice(i, i + 2);
        if (redirectOps.has(fourCharOp)) {
          if (currentToken.length > 0) {
            tokens.push(currentToken);
            currentToken = "";
          }
          tokens.push(fourCharOp);
          i += 4;
          continue;
        } else if (redirectOps.has(threeCharOp)) {
          if (currentToken.length > 0) {
            tokens.push(currentToken);
            currentToken = "";
          }
          tokens.push(threeCharOp);
          i += 3;
          continue;
        } else if (redirectOps.has(twoCharOp) || operators.has(twoCharOp)) {
          if (currentToken.length > 0) {
            tokens.push(currentToken);
            currentToken = "";
          }
          tokens.push(twoCharOp);
          i += 2;
          continue;
        } else if (operators.has(char) || [">", "<"].includes(char)) {
          if (currentToken.length > 0) {
            tokens.push(currentToken);
            currentToken = "";
          }
          tokens.push(char);
          i++;
          continue;
        }
      }
    }
    currentToken += char;
    i++;
  }
  if (currentToken.length > 0 || wasQuoted) {
    tokens.push(currentToken);
  }
  if (inSingleQuote || inDoubleQuote) {
    throw new Error("Unmatched quote");
  } else {
    return tokens;
  }
}

// app/components/parser.ts
function parseSingleCommand(tokens) {
  const redirections = [];
  const commandTokens = [];
  for (let i = 0;i < tokens.length; i++) {
    const token = tokens[i];
    if (token === ">" || token === "1>" || token === "2>" || token === ">>" || token === "1>>" || token === "2>>") {
      const target = tokens[i + 1];
      if (target === undefined) {
        commandTokens.push(token);
        continue;
      }
      const fd = token === "2>" || token === "2>>" ? 2 : 1;
      const type = token === ">>" || token === "1>>" || token === "2>>" ? "append" : "write";
      redirections.push({ fd, target, type });
      i++;
      continue;
    }
    commandTokens.push(token);
  }
  return {
    command: commandTokens[0],
    args: commandTokens.slice(1),
    redirections
  };
}
function parser(tokens) {
  const commands = [];
  let currentTokens = [];
  for (const token of tokens) {
    if (token === "|") {
      if (currentTokens.length > 0) {
        commands.push(parseSingleCommand(currentTokens));
      }
      currentTokens = [];
    } else {
      currentTokens.push(token);
    }
  }
  if (currentTokens.length > 0) {
    commands.push(parseSingleCommand(currentTokens));
  }
  return commands;
}

// app/builtins/builtins.ts
var builtInCommands = {
  echo: (args) => {
    console.log(args.join(" "));
  },
  exit: () => {
    process.exit(0);
  },
  pwd: () => {
    console.log(process.cwd());
  },
  cd: (args) => {
    const dir = args[0];
    try {
      if (dir === "~") {
        process.chdir(process.env.HOME || "");
      } else {
        process.chdir(dir);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        console.error(`cd: ${dir}: No such file or directory`);
      } else {
        console.error(`cd: ${dir}: ${error.message}`);
      }
    }
  },
  type: (args) => {
    const command = args[0];
    if (builtInCommands.hasOwnProperty(command)) {
      console.log(`${command} is a shell builtin`);
      return;
    }
    const PATH = process.env.PATH || "";
    const directories = PATH.split(__require("path").delimiter);
    const fs = __require("fs");
    const path = __require("path");
    for (const dir of directories) {
      const fullPath = path.join(dir, command);
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        console.log(`${command} is ${fullPath}`);
        return;
      } catch {}
    }
    console.log(`${command}: not found`);
  }
};

// app/utils/execExternalCommand.ts
import { spawn } from "child_process";
function execExternalCommand(command, args, stdio = "inherit") {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio,
      argv0: command
    });
    child.on("error", () => {
      console.error(`${command}: command not found`);
      resolve();
    });
    child.on("exit", () => {
      resolve();
    });
  });
}

// app/components/dispatcher.ts
import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";
import { spawn as spawn2 } from "child_process";
async function dispatcher(commands) {
  if (commands.length === 0)
    return;
  console.log("Dispatching:", JSON.stringify(commands, null, 2));
  if (commands.length === 1) {
    const commandStructure = commands[0];
    const { command, args, redirections } = commandStructure;
    if (!command) {
      console.error("Error: No command entered.");
      return;
    }
    if (builtInCommands.hasOwnProperty(command)) {
      let stdoutTarget;
      let stderrTarget;
      for (const r of redirections) {
        if (r.fd === 1)
          stdoutTarget = { path: r.target, mode: r.type };
        if (r.fd === 2)
          stderrTarget = { path: r.target, mode: r.type };
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
        console.log = (message, ..._optionalParams) => {
          stdoutStream.write(`${message ?? ""}
`);
        };
      }
      if (stderrStream) {
        console.error = (message, ..._optionalParams) => {
          stderrStream.write(`${message ?? ""}
`);
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
        let stdout = "inherit";
        let stderr = "inherit";
        const fdsToClose = [];
        const removeFromCloseList = (fd) => {
          const idx = fdsToClose.indexOf(fd);
          if (idx !== -1)
            fdsToClose.splice(idx, 1);
        };
        const closeFd = (fd) => {
          try {
            fs.closeSync(fd);
          } catch {}
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
  } else {
    let previousProcess = null;
    const processes = [];
    for (let i = 0;i < commands.length; i++) {
      const cmd = commands[i];
      const isFirst = i === 0;
      const isLast = i === commands.length - 1;
      const stdio = [
        isFirst ? "inherit" : "pipe",
        isLast ? "inherit" : "pipe",
        "inherit"
      ];
      console.log(`[DEBUG] Spawning ${cmd.command} with stdio:`, stdio);
      const child = spawn2(cmd.command, cmd.args, { stdio });
      child.on("exit", (code) => console.log(`[DEBUG] ${cmd.command} exited with ${code}`));
      processes.push(child);
      if (previousProcess) {
        if (previousProcess.stdout && child.stdin) {
          console.log(`[DEBUG] Piping ${previousProcess.pid} to ${child.pid}`);
          previousProcess.stdout.pipe(process.stdout, { end: false });
          previousProcess.stdout.pipe(child.stdin);
          previousProcess.stdout.on("data", (chunk) => {
            console.log(`[DEBUG] Chunk: ${chunk.toString()}`);
          });
        } else {
          console.error(`Pipeline error: Missing streams. prev.stdout=${!!previousProcess.stdout}, curr.stdin=${!!child.stdin}`);
        }
      }
      previousProcess = child;
    }
    await Promise.all(processes.map((p) => new Promise((resolve) => {
      p.on("exit", () => resolve());
      p.on("error", () => resolve());
    })));
  }
}

// app/components/completer.ts
import fs3 from "fs";
import path3 from "path";

// app/utils/pathCache.ts
import fs2 from "fs";
import path2 from "path";
var executableCache = null;
function getExecutables() {
  if (executableCache) {
    return executableCache;
  }
  executableCache = new Set;
  const pathEnv = process.env.PATH || "";
  const directories = pathEnv.split(path2.delimiter);
  for (const dir of directories) {
    try {
      if (!fs2.existsSync(dir))
        continue;
      const files = fs2.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() || file.isSymbolicLink()) {
          executableCache.add(file.name);
        }
      }
    } catch (error) {}
  }
  return executableCache;
}

// app/components/completer.ts
var lastLine = "";
var tabCount = 0;
function getCommonPrefix(strings) {
  if (strings.length === 0)
    return "";
  let prefix = strings[0];
  for (let i = 1;i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === "")
        return "";
    }
  }
  return prefix;
}
function completer(line, rl) {
  if (line !== lastLine) {
    tabCount = 0;
    lastLine = line;
  }
  tabCount++;
  const isCommand = !line.trimStart().includes(" ");
  if (isCommand) {
    const partial = line.trimStart();
    const builtins = Object.keys(builtInCommands);
    const executables = Array.from(getExecutables());
    const allCommands = Array.from(new Set([...builtins, ...executables]));
    let matches = allCommands.filter((c) => c.startsWith(partial)).sort();
    if (matches.length === 1) {
      matches = matches.map((c) => c + " ");
    }
    if (matches.length === 0) {
      process.stdout.write("\x07");
      return [[], partial];
    }
    if (matches.length > 1) {
      const commonPrefix = getCommonPrefix(matches);
      if (commonPrefix.length > partial.length) {
        return [matches, partial];
      }
      if (tabCount === 1) {
        process.stdout.write("\x07");
        return [[], partial];
      }
      process.stdout.write(`
`);
      process.stdout.write(matches.join("  "));
      process.stdout.write(`
`);
      rl?.prompt(true);
      return [[], partial];
    }
    return [matches, partial];
  } else {
    const lastSpaceIndex = line.lastIndexOf(" ");
    const partial = line.substring(lastSpaceIndex + 1);
    let searchDir;
    let filePrefix;
    if (partial.endsWith("/")) {
      searchDir = partial;
      filePrefix = "";
    } else {
      searchDir = path3.dirname(partial);
      filePrefix = path3.basename(partial);
    }
    try {
      const effectiveDir = searchDir === "." || searchDir === "" ? "." : searchDir;
      if (fs3.existsSync(effectiveDir)) {
        const stats = fs3.statSync(effectiveDir);
        if (stats.isDirectory()) {
          const files = fs3.readdirSync(effectiveDir, { withFileTypes: true });
          const matches = files.filter((f) => f.name.startsWith(filePrefix)).map((f) => {
            let name = f.name;
            if (f.isDirectory()) {
              name += "/";
            } else {
              name += " ";
            }
            if (searchDir === "." || searchDir === "") {
              return name;
            } else {
              const joined = path3.join(searchDir, name);
              return joined.split(path3.sep).join("/");
            }
          });
          if (matches.length === 0) {
            process.stdout.write("\x07");
            return [[], partial];
          }
          if (matches.length > 1) {}
          return [matches, partial];
        }
      }
    } catch (e) {}
    process.stdout.write("\x07");
    return [[], partial];
  }
}

// app/main.ts
var rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => completer(line, rl)
});
rl.setPrompt("$ ");
rl.prompt();
rl.on("line", async (line) => {
  const tokens = tokenizer(line);
  const commands = parser(tokens);
  await dispatcher(commands);
  rl.prompt();
});
