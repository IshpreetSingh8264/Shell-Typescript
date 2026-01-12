import type { CommandStructure, Token } from "../types/types";




/*
## Layer 2: Parser

### 🎯 Purpose

A tiny but crucial layer that decides the command name, arguments, and options.

### 📥 Process Flow

1. **Takes list of tokens** from the lexer
2. **Understands** what is a command and what is an argument
3. **Builds a command structure** that can be executed by the shell

### 📐 Rules

- `tokens[0]` → **Command**
- Rest → **Arguments**

### 📤 Output Format

**Type:** Object with command name and arguments array

### 💡 Example

**Input:**

```bash
echo "Hello   world" foo\ bar 'baz'
```

**Output:**

```typescript
{
  command: 'echo',
  args: ['Hello   world', 'foo bar', 'baz']
}
```
*/




export function parser(tokens: string[]): CommandStructure {
  const redirectionIndex = tokens.indexOf(">");

  if (redirectionIndex !== -1) {
    // Extract the output file and remove the `>` symbol and file from tokens
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