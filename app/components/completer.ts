import fs from "fs";
import path from "path";
import { builtInCommands } from "../builtins/builtins";
import { getExecutables } from "../utils/pathCache";

export function completer(line: string): [string[], string] {
  // Check if we are completing the first word (command) or subsequent words (arguments)
  const isCommand = !line.trimStart().includes(" ");

  if (isCommand) {
    const partial = line.trimStart();
    const builtins = Object.keys(builtInCommands);
    const executables = Array.from(getExecutables());
    
    // Use a Set to deduplicate in case a builtin is also in PATH
    const allCommands = Array.from(new Set([...builtins, ...executables]));

    const matches = allCommands
        .filter((c) => c.startsWith(partial))
        .sort()
        .map(c => c + " "); // Add space for convenience

    // If we have multiple matches, we should return them all.
    // If we have a single match, readline will auto-complete it.
    // However, readline's default behavior with multiple matches is to show them.
    // We just return the array.
    if (matches.length === 0) {
        process.stdout.write("\x07");
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
