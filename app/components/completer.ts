import fs from "fs";
import path from "path";
import { builtInCommands } from "../builtins/builtins";
import { getExecutables } from "../utils/pathCache";
import type { Interface } from "readline";

let lastLine = "";
let tabCount = 0;

// Helper to calculate common prefix
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

export function completer(line: string, rl?: Interface): [string[], string] {
  // Reset tab count if line changed
  if (line !== lastLine) {
      tabCount = 0;
      lastLine = line;
  }
  tabCount++;

  // Check if we are completing the first word (command) or subsequent words (arguments)
  const isCommand = !line.trimStart().includes(" ");

  if (isCommand) {
    const partial = line.trimStart();
    const builtins = Object.keys(builtInCommands);
    const executables = Array.from(getExecutables());
    
    // Use a Set to deduplicate in case a builtin is also in PATH
    const allCommands = Array.from(new Set([...builtins, ...executables]));

    let matches = allCommands
        .filter((c) => c.startsWith(partial))
        .sort();

    if (matches.length === 1) {
        matches = matches.map(c => c + " ");
    }

    if (matches.length === 0) {
        process.stdout.write("\x07");
        return [[], partial];
    }

    if (matches.length > 1) {
        const commonPrefix = getCommonPrefix(matches);
        // If we can extend the current partial, let readline do it (it will auto-complete to common prefix)
        if (commonPrefix.length > partial.length) {
            return [matches, partial];
        }
        
        // If we are already at the common prefix, we need the double-tab logic
        if (tabCount === 1) {
            process.stdout.write("\x07");
            return [[], partial]; // Return empty to suppress default list behavior
        }
        
        // On second tab, print matches manually and redraw prompt
        process.stdout.write("\n");
        process.stdout.write(matches.join("  "));
        process.stdout.write("\n");
        
        rl?.prompt(true);
        
        return [[], partial];
    }

    return [matches, partial];
  } else {
    // Argument completion (File paths)
    const lastSpaceIndex = line.lastIndexOf(" ");
    const partial = line.substring(lastSpaceIndex + 1);

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
        // Handle ~ expansion for completion if needed, but let's stick to basic paths first
        // If searchDir is empty or dot, we use "."
        const effectiveDir = (searchDir === "." || searchDir === "") ? "." : searchDir;

        if (fs.existsSync(effectiveDir)) {
            const stats = fs.statSync(effectiveDir);
            if (stats.isDirectory()) {
                const files = fs.readdirSync(effectiveDir, { withFileTypes: true });
                const matches = files
                    .filter(f => f.name.startsWith(filePrefix))
                    .map(f => {
                        let name = f.name;
                        if (f.isDirectory()) {
                            name += "/";
                        } else {
                            name += " ";
                        }
                        
                        // Reconstruct the full path relative to the partial input
                        if (searchDir === "." || searchDir === "") {
                            return name;
                        } else {
                            // Ensure we join correctly with the user's input directory
                            // If user typed "app/", searchDir is "app/". join("app/", "main.ts") -> "app/main.ts"
                            // If user typed "app/co", searchDir is "app". join("app", "components/") -> "app/components/"
                            const joined = path.join(searchDir, name);
                            return joined.split(path.sep).join("/"); // Normalize to forward slashes
                        }
                    });

                if (matches.length === 0) {
                    process.stdout.write("\x07");
                    return [[], partial];
                }

                if (matches.length > 1) {
                    // For arguments, we might want similar behavior, but the requirement was specific to executables.
                    // However, consistent behavior is good.
                    // But let's stick to the requirement for executables first.
                    // If we want to apply it to arguments too:
                    /*
                    const commonPrefix = getCommonPrefix(matches);
                    // Note: matches here are full paths or names, we need to be careful.
                    // But readline handles the prefix logic based on the returned array.
                    // If we return matches, readline calculates common prefix of the returned strings.
                    
                    // Let's just return matches for arguments for now as per previous stage.
                    */
                }

                return [matches, partial];
            }
        }
    } catch (e) {
        // Ignore errors (e.g. permission denied, invalid path)
    }

    process.stdout.write("\x07");
    return [[], partial];
  }
}
