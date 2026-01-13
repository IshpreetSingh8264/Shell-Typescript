# Copilot Instructions for Codecrafters Shell (TypeScript)

This document provides guidance for AI coding agents to be productive in this codebase. It outlines the architecture, workflows, and conventions specific to this project.

## Project Overview

This project is a TypeScript implementation of a POSIX-compliant shell as part of the Codecrafters "Build Your Own Shell" challenge. The shell interprets commands, executes external programs, and supports built-in commands like `cd`, `pwd`, and `echo`.

### Key Components

- **Entry Point**: `app/main.ts` is the main entry point for the shell implementation.
- **Command Parsing**: `app/components/parser.ts` handles parsing of shell commands.
- **Tokenization**: `app/components/tokenizer.ts` breaks down input into tokens.
- **Command Execution**: `app/utils/execExternalCommand.ts` executes external commands.
- **Built-in Commands**: `app/builtins/builtins.ts` implements built-in shell commands.
- **Types**: `app/types/types.ts` defines shared TypeScript types.

### Data Flow
1. User input is tokenized by `tokenizer.ts`.
2. Tokens are parsed into commands by `parser.ts`.
3. Commands are dispatched for execution by `dispatcher.ts`.
4. Built-in commands are handled by `builtins.ts`, while external commands are executed by `execExternalCommand.ts`.

## Developer Workflows

### Building and Running
- Ensure `bun` (version 1.2) is installed.
- Run the shell using the script:
  ```sh
  ./your_program.sh
  ```

### Testing
- Commit your changes and push to the `master` branch to trigger Codecrafters' test suite:
  ```sh
  git commit -am "Your message"
  git push origin master
  ```
- Test results will be streamed to your terminal.

### Debugging
- Use `console.log` for debugging. Key files to inspect include:
  - `parser.ts` for command parsing issues.
  - `execExternalCommand.ts` for execution errors.

## Project-Specific Conventions

- **Error Handling**: Use `try-catch` blocks around external command execution to handle runtime errors gracefully.
- **TypeScript**: Ensure all functions and variables are strongly typed. Shared types are defined in `types.ts`.
- **Built-in Commands**: Implement new built-ins in `builtins.ts` and update the dispatcher to route them correctly.

## Integration Points

- **External Commands**: Executed via `execExternalCommand.ts` using the `child_process` module.
- **Built-in Commands**: Extend `builtins.ts` for additional functionality.

## Examples

### Adding a New Built-in Command
1. Define the command in `builtins.ts`:
   ```typescript
   export function myCommand(args: string[]): void {
       console.log("My Command Executed", args);
   }
   ```
2. Update the dispatcher in `dispatcher.ts` to route the new command.

### Debugging Tokenization
- Add logs in `tokenizer.ts`:
  ```typescript
  console.log("Tokens:", tokens);
  ```

## Key Files and Directories

- `app/main.ts`: Entry point.
- `app/components/`: Core logic for parsing and tokenization.
- `app/utils/`: Utility functions for command execution.
- `app/builtins/`: Built-in command implementations.
- `app/types/`: Shared TypeScript types.

---

For more details, refer to the [README.md](../README.md) or the Codecrafters challenge documentation.