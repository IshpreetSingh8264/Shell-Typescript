import type { CommandStructure } from "../types/types";

export function parser(tokens: string[]): CommandStructure {
  const redirectionIndex = tokens.findIndex((token) => token === ">" || token === "1>");

  if (redirectionIndex !== -1) {
    // Extract the output file and remove the redirection symbol and file from tokens
    const outputFile = tokens[redirectionIndex + 1];
    const commandTokens = tokens.slice(0, redirectionIndex);

    return {
      command: commandTokens[0],
      args: commandTokens.slice(1),
      outputFile,
    };
  }

  return {
    command: tokens[0],
    args: tokens.slice(1),
  };
}