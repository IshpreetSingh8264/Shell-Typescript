import { createInterface, Interface } from "readline";
import { tokenizer } from "./components/tokenizer";
import { parser } from "./components/parser";
import { dispatcher } from "./components/dispatcher";
import { completer } from "./components/completer";
import { addToHistory } from "./utils/history";

const rl: Interface = createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line: string) => completer(line, rl),
});


rl.setPrompt("$ ")
rl.prompt()

rl.on('line', async (line) => {
  addToHistory(line);
  const tokens = tokenizer(line);
  const commandStructure = parser(tokens);
  await dispatcher(commandStructure);
  rl.prompt()
})

