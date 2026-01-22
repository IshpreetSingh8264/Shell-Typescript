export const history: string[] = [];
let lastAppendedIndex = 0;

export function addToHistory(line: string) {
    if (line.trim()) {
        history.push(line);
    }
}

export function getHistory() {
    return history;
}

export function getNewHistory() {
    return history.slice(lastAppendedIndex);
}

export function markHistoryAsAppended() {
    lastAppendedIndex = history.length;
}
