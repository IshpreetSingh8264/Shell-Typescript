import fs from "fs";
import path from "path";
import { builtInCommands } from "../builtins/builtins";
import { getExecutables } from "../utils/pathCache";
import { currentAndPreviousWord, getCompletionSpec, runCompleter } from "../utils/completions";
import type { Interface } from "readline";

let lastLine = "";
let tabCount = 0;

// The course asks for an audible/visible bell by writing the BEL byte to stdout,
// both when nothing matches and when a second TAB is needed to list candidates.
const BELL = "\x07";

function getCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return "";
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
        while (!strings[i].startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
            if (prefix === "") return "";
        }
    }
    return prefix;
}

/**
 * Turns a candidate list into the answer readline needs. Every position -
 * command word, file name, registered completer - resolves the same way:
 *
 *   none        ring the bell, change nothing
 *   one         insert it (the caller has already added the trailing space)
 *   several     insert their longest common prefix when that adds characters,
 *               otherwise bell on the first TAB and list them, sorted and two
 *               spaces apart, on the second
 */
function resolveCandidates(candidates: string[], partial: string, rl?: Interface): [string[], string] {
    if (candidates.length === 0) {
        process.stdout.write(BELL);
        return [[], partial];
    }

    if (candidates.length === 1) {
        // The word is finished, so separate it from the next one. Directories
        // already end in "/" and must not gain a space.
        const only = candidates[0].endsWith("/") ? candidates[0] : candidates[0] + " ";
        return [[only], partial];
    }

    const commonPrefix = getCommonPrefix(candidates);
    if (commonPrefix.length > partial.length) {
        // Let readline extend the line to the common prefix.
        return [candidates, partial];
    }

    if (tabCount === 1) {
        process.stdout.write(BELL);
        return [[], partial];
    }

    process.stdout.write("\n");
    process.stdout.write([...candidates].sort().join("  "));
    process.stdout.write("\n");
    rl?.prompt(true);
    return [[], partial];
}

/** Candidates for the command word: builtins plus everything executable in PATH. */
function commandCandidates(partial: string): string[] {
    const all = new Set([...Object.keys(builtInCommands), ...getExecutables()]);
    return Array.from(all).filter(name => name.startsWith(partial)).sort();
}

/** Candidates for an argument: entries in the directory being completed. */
function pathCandidates(partial: string): string[] {
    let searchDir: string;
    let filePrefix: string;

    if (partial.endsWith("/")) {
        searchDir = partial;
        filePrefix = "";
    } else {
        searchDir = path.dirname(partial);
        filePrefix = path.basename(partial);
    }

    try {
        const effectiveDir = (searchDir === "." || searchDir === "") ? "." : searchDir;
        if (!fs.existsSync(effectiveDir) || !fs.statSync(effectiveDir).isDirectory()) {
            return [];
        }

        return fs.readdirSync(effectiveDir, { withFileTypes: true })
            .filter(entry => entry.name.startsWith(filePrefix))
            .map(entry => {
                // Directories keep their trailing slash; resolveCandidates adds
                // the separating space to files when there is a single match.
                const name = entry.isDirectory() ? entry.name + "/" : entry.name;
                if (searchDir === "." || searchDir === "") {
                    return name;
                }
                // If the user typed "app/co", searchDir is "app" and this
                // rebuilds "app/components/".
                return path.join(searchDir, name).split(path.sep).join("/");
            });
    } catch {
        // Permission denied, invalid path, race with a disappearing file.
        return [];
    }
}

/**
 * Completion driven by a script registered with `complete -C`. Returns null
 * when the line's command word has no such specification, so completion falls
 * through to the built-in behaviour.
 */
function programmableCandidates(line: string): { candidates: string[]; partial: string } | null {
    const command = line.trimStart().split(/\s/)[0];
    if (command === undefined) return null;

    const script = getCompletionSpec(command);
    if (script === undefined) return null;

    const { current, previous } = currentAndPreviousWord(line);
    const candidates = runCompleter(script, command, current, previous, line);

    return { candidates, partial: current };
}

export function completer(line: string, rl?: Interface): [string[], string] {
    // Reset tab count if line changed
    if (line !== lastLine) {
        tabCount = 0;
        lastLine = line;
    }
    tabCount++;

    const programmable = programmableCandidates(line);
    if (programmable !== null) {
        return resolveCandidates(programmable.candidates, programmable.partial, rl);
    }

    // Completing the first word means a command name; anything else is a path.
    if (!line.trimStart().includes(" ")) {
        const partial = line.trimStart();
        return resolveCandidates(commandCandidates(partial), partial, rl);
    }

    const partial = line.slice(line.lastIndexOf(" ") + 1);
    return resolveCandidates(pathCandidates(partial), partial, rl);
}
