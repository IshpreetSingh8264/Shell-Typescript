export type Redirection = {
    fd: 1 | 2;
    target: string;
    type: "write" | "append";
};

export interface CommandStructure {
    command: string;
    args: string[];
    redirections: Redirection[];
}