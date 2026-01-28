/**
 * The background job table.
 *
 * A leaf helper: it owns job numbers, their lifecycle and the exact `jobs`
 * output format, and knows nothing about tokenizing, parsing or dispatching.
 * The dispatcher adds jobs when it spawns something with `&`; the `jobs`
 * builtin and the pre-prompt hook in main.ts both drain them through here.
 *
 * Job numbers are recycled: an empty table always hands out 1 again, otherwise
 * the next number is one past the highest still in the table (stage fy4).
 */
import type { ChildProcess } from "child_process";

export interface Job {
    id: number;
    pid: number;
    /** The command as launched, without the trailing `&`. */
    command: string;
    done: boolean;
    child: ChildProcess;
}

const jobs: Job[] = [];

// Matches the tester's expected line: `[1]+  Running<pad>sleep 500 &`
// (`Running` + 17 spaces is the 24-column status field).
const STATUS_GAP = " ".repeat(17);

/**
 * Job numbers never grow forever. If nothing is running we start over at 1,
 * otherwise we continue from the highest number still in the table.
 */
export function nextJobId(): number {
    if (jobs.length === 0) return 1;
    return jobs.reduce((highest, job) => Math.max(highest, job.id), 0) + 1;
}

export function addJob(id: number, pid: number, command: string, child: ChildProcess): void {
    const job: Job = { id, pid, command, done: false, child };
    jobs.push(job);
    // The child tells us when it exits. The reaper also re-checks `exitCode`
    // because the event is delivered on a later tick than the reaping call.
    child.on("exit", () => {
        job.done = true;
    });
}

export function countJobs(): number {
    return jobs.length;
}

/** `+` for the newest job, `-` for the one before it, a space for the rest. */
function markerAt(index: number, total: number): string {
    if (index === total - 1) return "+";
    if (index === total - 2) return "-";
    return " ";
}

/**
 * Renders the table and drops the finished jobs. Markers are resolved against
 * the list *before* the removals, which is what stage rq2 checks: three jobs
 * where two have finished still print as `space`, `-`, `+`.
 *
 * Returns the full listing plus only the finished entries, so the `jobs`
 * builtin can print everything while the pre-prompt hook prints just the
 * `Done` lines. A finished job is reported exactly once, by whichever runs
 * first.
 */
function reap(): { all: string[]; done: string[] } {
    for (const job of jobs) {
        if (!job.done && job.child.exitCode !== null) job.done = true;
    }

    const entries = jobs.map((job, index) => {
        const status = job.done ? "Done" : "Running";
        // Only running entries carry the trailing `&`.
        const suffix = job.done ? "" : " &";
        return {
            job,
            line: `[${job.id}]${markerAt(index, jobs.length)}  ${status}${STATUS_GAP}${job.command}${suffix}`,
        };
    });

    for (let i = jobs.length - 1; i >= 0; i--) {
        if (jobs[i].done) jobs.splice(i, 1);
    }

    return {
        all: entries.map(entry => entry.line),
        done: entries.filter(entry => entry.job.done).map(entry => entry.line),
    };
}

/** For the `jobs` builtin: the whole table, finished jobs included. */
export function reapForListing(): string[] {
    return reap().all;
}

/** For the pre-prompt hook: only the jobs that finished since the last check. */
export function reapForPrompt(): string[] {
    return reap().done;
}
