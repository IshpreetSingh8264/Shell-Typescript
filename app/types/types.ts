export interface CommandStructure {
    command: string;
    args: string[];
    outputFile?: string; // Add this field for redirection
}