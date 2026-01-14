import fs from "fs";
import path from "path";

let executableCache: Set<string> | null = null;

export function getExecutables(): Set<string> {
  if (executableCache) {
    return executableCache;
  }

  executableCache = new Set();
  const pathEnv = process.env.PATH || "";
  const directories = pathEnv.split(path.delimiter);

  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() || file.isSymbolicLink()) {
            // On Linux/Unix, we should check for executable permission, 
            // but simply listing files in PATH is usually a good enough approximation for completion
            // and much faster than accessSync on every file.
            executableCache.add(file.name);
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }

  return executableCache;
}
