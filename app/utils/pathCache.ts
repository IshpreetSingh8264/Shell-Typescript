import fs from "fs";
import path from "path";

let executableCache: Set<string> | null = null;
// The PATH the cache was built from. If PATH changes, the cache is stale.
let cachedPathEnv: string | null = null;

export function getExecutables(): Set<string> {
  const pathEnv = process.env.PATH || "";
  if (executableCache && cachedPathEnv === pathEnv) {
    return executableCache;
  }

  executableCache = new Set();
  cachedPathEnv = pathEnv;
  const directories = pathEnv.split(path.delimiter);

  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() || file.isSymbolicLink()) {
          // Listing a directory is not enough: anything without the exec bit
          // cannot be run, so offering it as a completion is wrong.
          try {
            fs.accessSync(path.join(dir, file.name), fs.constants.X_OK);
            executableCache.add(file.name);
          } catch {
            // Not executable - not a command.
          }
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }

  return executableCache;
}
