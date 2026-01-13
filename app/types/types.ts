export type Redirection = {
    fd: 1 | 2;
    target: string;
};

export interface CommandStructure {
    command: string;
    args: string[];
    redirections: Redirection[];
}