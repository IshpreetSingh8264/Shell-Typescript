import { createInterface, Interface } from "readline";
import { tokenizer } from "./components/tokenizer";
import { parser } from "./components/parser";
import { dispatcher } from "./components/dispatcher";
import { completer } from "./components/completer";
import { addToHistory, markHistoryAsAppended, getNewHistory } from "./utils/history";
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

function saveHistory() {
  if (histFile) {
    try {
      const newHist = getNewHistory();
      if (newHist.length > 0) {
        fs.appendFileSync(histFile, newHist.join('\n') + '\n');
        markHistoryAsAppended();
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

process.on('exit', () => {
  saveHistory();
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

