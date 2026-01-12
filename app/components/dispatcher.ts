import { builtInCommands } from "../builtins/builtins";
import type { CommandStructure } from "../types/types";
import { execExternalCommand } from "../utils/execExternalCommand";
import { createWriteStream } from "fs";

export async function dispatcher(commandStructure: CommandStructure): Promise<void> {
    const { command, args, outputFile } = commandStructure;

    if (!command) {
        console.error("Error: No command entered.");
        return;
    }

    if (builtInCommands.hasOwnProperty(command)) {
        // Execute built-in command
        if (outputFile) {
            // Redirect output of built-in commands
            const outputStream = createWriteStream(outputFile, { flags: "w" });
            const originalConsoleLog = console.log;

            // Temporarily override console.log to redirect output
            console.log = (message?: any, ...optionalParams: any[]) => {
                outputStream.write(`${message}\n`);
            };

            await builtInCommands[command](args);

            // Restore original console.log
            console.log = originalConsoleLog;
            outputStream.end();
        } else {
            await builtInCommands[command](args);
        }
    } else {
        // Execute external command
        try {
            if (outputFile) {
                // Redirect output to the specified file
                const outputStream = createWriteStream(outputFile, { flags: "w" });
                await execExternalCommand(command, args, outputStream);
                outputStream.end();
            } else {
                await execExternalCommand(command, args);
            }
        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to execute command: ${error.message}`);
            } else {
                console.error("Failed to execute command: An unknown error occurred.");
            }
        }
    }
}