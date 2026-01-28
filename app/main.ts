import { createInterface, Interface } from "readline";
import { tokenizer } from "./components/tokenizer";
import { parser } from "./components/parser";
import { dispatcher } from "./components/dispatcher";
import { completer } from "./components/completer";
import { addToHistory, getHistory, markHistoryAsAppended } from "./utils/history";
import { reapForPrompt } from "./utils/jobs";
import { getExitCode, isShutdownRequested, onShutdown, runShutdownHooks } from "./utils/shutdown";
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
      // writeFileSync, not appendFileSync: a pre-existing HISTFILE is rewritten,
      // not appended to. Lines that were already in the file are still present
      // because loadHistory() put them at the front of the in-memory history,
      // so nothing is lost - but a stale/duplicated file is replaced.
      const hist = getHistory();
      if (hist.length > 0) {
        fs.writeFileSync(histFile, hist.join('\n') + '\n');
        markHistoryAsAppended();
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

onShutdown(saveHistory);

// Fallback for paths that end the process without going through `exit`
// (e.g. stdin reaching EOF): saveHistory is synchronous and idempotent.
process.on('exit', saveHistory);

rl.setPrompt("$ ");
rl.prompt()

/**
 * readline emits every line of a pipe in a single tick, so an `async` handler
 * would run all of them concurrently and interleave their output. Chaining each
 * line onto the previous one keeps commands strictly sequential.
 */
let commandQueue: Promise<void> = Promise.resolve();

rl.on('line', (line) => {
  commandQueue = commandQueue.then(() => runLine(line));
});

async function runLine(line: string): Promise<void> {
  if (isShutdownRequested()) return; // `exit` already ended the session
  addToHistory(line);
  try {
    const commandStructure = parser(tokenizer(line));
    await dispatcher(commandStructure);
  } catch (e) {
    console.error(`${(e as Error).message}`);
  }
  if (isShutdownRequested()) {
    await shutdown();
    return;
  }
  // Announce jobs that finished since the last prompt, then prompt. The Done
  // lines land between this command's output and the next "$ ".
  for (const line of reapForPrompt()) {
    console.log(line);
  }
  rl.prompt();
}

let didShutdown = false;

async function shutdown(): Promise<void> {
  if (didShutdown) return;
  didShutdown = true;
  await runShutdownHooks();
  process.exitCode = getExitCode();
  // Release the only handles keeping the loop alive so the process ends on its
  // own. Ending it here (rather than process.exit) lets buffered stdout and
  // redirect writes flush first.
  rl.close();
  process.stdin.pause();
}
