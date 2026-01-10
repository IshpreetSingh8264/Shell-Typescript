import { builtInCommands } from "../builtins/builtins";
import type { CommandStructure } from "../types/types";
import { execExternalCommand } from "../utils/execExternalCommand";

export async function dispatcher(commandStructure: CommandStructure): Promise<void> {
    const { command, args } = commandStructure;

    if (!command) {
        console.error("Error: No command entered.");
        return;
    }

    if (builtInCommands.hasOwnProperty(command)) {
        // Execute built-in command
        await builtInCommands[command](args);
    } else {
        // Execute external command
        try {
            await execExternalCommand(command, args);
        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to execute command: ${error.message}`);
            } else {
                console.error("Failed to execute command: An unknown error occurred.");
            }
        }
    }
}