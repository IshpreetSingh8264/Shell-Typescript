import { createInterface, Interface } from "readline";
import { tokenizer } from "./components/tokenizer";
import { parser } from "./components/parser";
import { dispatcher } from "./components/dispatcher";
import { completer } from "./components/completer";
import { addToHistory, markHistoryAsAppended } from "./utils/history";
import fs from "fs";

const rl: Interface = createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line: string) => completer(line, rl),
});

// Load history from HISTFILE if available
const histFile = process.env.HISTFILE;
if (histFile && fs.existsSync(histFile)) {
  try {
    const content = fs.readFileSync(histFile, 'utf-8');
    content.split('\n').forEach(line => {
      if (line) addToHistory(line);
    });
    markHistoryAsAppended();
  } catch (e) {
    // Ignore errors
  }
}

rl.setPrompt("$ ")
rl.prompt()

rl.on('line', async (line) => {
  addToHistory(line);
  const tokens = tokenizer(line);
  const commandStructure = parser(tokens);
  await dispatcher(commandStructure);
  rl.prompt()
})

