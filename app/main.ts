import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});



// rl.question("$ ", (answer) => {
//   console.log(`${answer}: command not found`)
//   rl.close();
// });
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
    } else {
      console.log(`${command}: not found`);
      return rl.prompt()
    }
    console.log(`${line}: command not found`)
    rl.prompt()
  }
})

