import type { CommandStructure, Redirection } from "../types/types";

export function parser(tokens: string[]): CommandStructure {
  const redirections: Redirection[] = [];
  const commandTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === ">" || token === "1>" || token === "2>" || token === ">>" || token === "1>>" || token === "2>>") {
      const target = tokens[i + 1];
      if (target === undefined) {
        // Incomplete redirection; treat as a normal token.
        commandTokens.push(token);
        continue;
      }

      const fd: 1 | 2 = (token === "2>" || token === "2>>") ? 2 : 1;
      const type: "write" | "append" = (token === ">>" || token === "1>>" || token === "2>>") ? "append" : "write";
      
      redirections.push({ fd, target, type });
      i++; // Skip target
      continue;
    }

    commandTokens.push(token);
  }

  return {
    command: commandTokens[0],
    args: commandTokens.slice(1),
    redirections,
  };
}