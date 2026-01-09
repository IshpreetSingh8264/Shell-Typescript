import { createInterface } from "readline";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const builtincommands = ["echo", "exit", "type"]

rl.setPrompt("$ ")
rl.prompt()
rl.on('line', (line) => {

  if (line === "exit") {
    return rl.close();
  }


  if (line.startsWith("echo ")) {
    console.log(line.slice(5))
    rl.prompt()
    return
  }


  if (line.startsWith("type ")) {
    const command = line.slice(5)
    if (builtincommands.includes(command)) {
      console.log(`${command} is a shell builtin`);
      return rl.prompt()
    }
    const PATH = process.env.PATH || ""
    const directories = PATH.split(path.delimiter)
    for (const dir of directories) {
      const fullPath = path.join(dir, command)
      try {
        fs.accessSync(fullPath, fs.constants.X_OK)
        console.log(`${command} is ${fullPath}`);
        rl.prompt();
        return
      } catch {}
    }
  }
  const command = line.trim().split(" ")[0]
  const args = line.trim().split(" ").slice(1)
  const PATH = process.env.PATH || ""
  const directories = PATH.split(path.delimiter)
  for (const dir of directories) {
    const fullPath = path.join(dir, command)
    try {
      fs.accessSync(fullPath, fs.constants.X_OK)
      const child = spawn(fullPath, args, { stdio: 'inherit' })
      child.on('exit', () => {

        rl.prompt();
      })
      return
    } catch{}
    
  }

  console.log(`${line}: command not found`)
  rl.prompt()
})

