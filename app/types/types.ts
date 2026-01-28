export type Redirection = {
    fd: 1 | 2;
    target: string;
    type: "write" | "append";
};

export interface CommandStructure {
    command: string;
    args: string[];
    redirections: Redirection[];
    /** True when the line ended in `&`, so the shell must not wait for it. */
    background: boolean;
}