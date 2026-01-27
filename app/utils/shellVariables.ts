/**
 * The shell variable store.
 *
 * A leaf helper: it knows nothing about tokenizing, parsing or dispatching, it
 * only knows how to tell a legal variable name from an illegal one and how to
 * read/write a value. `declare` (builtins) writes here, the tokenizer's `$VAR`
 * expansion reads from here.
 *
 * Deliberately NOT backed by `process.env`: `declare -p` must report these as
 * plain shell variables (`declare -- NAME="VALUE"`), not as exported ones, and
 * the course never asks for environment lookup during expansion.
 */

const variables = new Map<string, string>();

/**
 * A shell variable name is a valid identifier: it starts with a letter or an
 * underscore, and the rest of the name may use letters, digits and underscores.
 * A digit must not be the first character.
 */
export function isValidIdentifier(name: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

export function hasVariable(name: string): boolean {
    return variables.has(name);
}

/** Unset variables expand to the empty string, so callers get "" not undefined. */
export function getVariable(name: string): string {
    return variables.get(name) ?? "";
}

export function setVariable(name: string, value: string): void {
    variables.set(name, value);
}
