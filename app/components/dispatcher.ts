/*
## Layer 3: Dispatcher & Executor

### 🎯 Purpose

Execute commands with proper built-in handling and external command execution.

### 📥 Process Flow

1. **Takes the command structure** from the parser
2. **Looks up the command** in shell's built-in commands or external commands
3. **Executes the command** with provided arguments and options
4. **Handles** input/output redirection, piping, and background execution

### 🔧 Responsibilities

```mermaid
graph LR
    A[Command Structure] --> B{Is Built-in?}
    B -->|Yes| C[Run Built-in Handler]
    B -->|No| D[Resolve + Execute External]
```

- ✅ Check if command is built-in
- ✅ If yes → run built-in handler
- ✅ Else → resolve + execute external

### 🏗️ Built-ins Architecture

Each built-in is a **pure function**:

```typescript
(args: string[]) => void | Promise<void>
```

> 🔍 **Note:** No parsing happens here — only execution! */

// implementation of dispatcher and executor
import { builtInCommands } from "../builtins/builtins";
import type { CommandStructure } from "../types/types";
import { execExternalCommand } from "../utils/execExternalCommand";

export async function dispatcher(commandStructure: CommandStructure): Promise<void> {
    const { command, args } = commandStructure;

    if (builtInCommands.hasOwnProperty(command)){
        // Execute built-in command
        await builtInCommands[command](args);
    }
    else {
        // Execute external command
        await execExternalCommand(command, args);
    }
}