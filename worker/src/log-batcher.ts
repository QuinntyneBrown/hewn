import type { LogLevel } from './api.ts';

export type LogLine = { level: LogLevel; text: string };

/**
 * Collects a run's log lines and sends them in batches (L2-031, L2-033): at most every `intervalMs`, at most
 * `maxBatch` lines a request, and on demand before a checkpoint or result, so the API stores and broadcasts one
 * event per batch rather than one per line. `add` never waits for the network.
 */
export class LogBatcher {
  private readonly pending: LogLine[] = [];
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly send: (lines: LogLine[]) => Promise<void>;
  private readonly onError: (error: unknown) => void;
  private readonly maxBatch: number;
  private sending: Promise<void> = Promise.resolve();

  constructor(
    send: (lines: LogLine[]) => Promise<void>,
    onError: (error: unknown) => void,
    intervalMs = 250,
    maxBatch = 500,
  ) {
    this.send = send;
    this.onError = onError;
    this.maxBatch = maxBatch;
    this.timer = setInterval(() => void this.flush(), intervalMs);
  }

  add(line: LogLine): void {
    this.pending.push(line);
    if (this.pending.length >= this.maxBatch) void this.flush();
  }

  /** Sends everything added so far; resolves once it has been sent (or failed and been reported). */
  flush(): Promise<void> {
    this.sending = this.sending.then(async () => {
      while (this.pending.length > 0) {
        const batch = this.pending.splice(0, this.maxBatch);
        try {
          await this.send(batch);
        } catch (error) {
          this.onError(error);
        }
      }
    });
    return this.sending;
  }

  /** Sends what is left and stops the timer. */
  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }
}
