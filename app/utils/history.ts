export const history: string[] = [];

export function addToHistory(line: string) {
    if (line.trim()) {
        history.push(line);
    }
}

export function getHistory() {
    return history;
}
