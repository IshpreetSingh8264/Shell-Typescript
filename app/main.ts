import { createInterface } from "readline";
import { tokenizer } from "./components/tokenizer";
import { parser } from "./components/parser";
import { dispatcher } from "./components/dispatcher";
import { completer } from "./components/completer";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  completer,
});


rl.setPrompt("$ ")
rl.prompt()

rl.on('line', async (line) => {
  const tokens = tokenizer(line);
  const commandStructure = parser(tokens);
  await dispatcher(commandStructure);
  rl.prompt()
})

