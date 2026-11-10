import type { Locator, Page, WebSocketRoute } from '@playwright/test';

/**
 * Mission Control's live connection, as a user sees it: the strip above the page and the sidebar's state, plus the
 * means to cut the connection the way a dropped network would (L2-032).
 */
export class LiveConnection {
  /** The connection strip: connecting, reconnecting, lost or reconnected. */
  readonly banner: Locator;
  readonly retryNow: Locator;
  /** The sidebar's Live / Reconnecting… / Offline label. */
  readonly state: Locator;
  /** The sidebar's "N of M workers". */
  readonly workerCount: Locator;
  /** Each time the client asked to connect (SignalR's negotiate request). */
  readonly attempts: number[] = [];
  private readonly sockets = new Set<WebSocketRoute>();
  private down = false;
  private negotiateDelayMs = 0;

  constructor(private readonly page: Page) {
    this.banner = page
      .locator('.strip')
      .filter({ hasText: /Connecting to Mission Control|Reconnecting|Reconnected|Connection lost/ });
    this.retryNow = this.banner.getByRole('button', { name: 'Retry now' });
    this.state = page.locator('.sidebar .conn__state');
    this.workerCount = page.locator('.sidebar .conn .tabular');
  }

  /** Routes the hub through the test, so it can be cut. Call before the page opens. */
  async intercept(options: { negotiateDelayMs?: number } = {}): Promise<void> {
    this.negotiateDelayMs = options.negotiateDelayMs ?? 0;
    await this.page.route('**/hubs/mission-control/negotiate**', async (route) => {
      this.attempts.push(Date.now());
      if (this.down) return route.abort('connectionrefused');
      if (this.negotiateDelayMs) await new Promise((r) => setTimeout(r, this.negotiateDelayMs));
      return route.continue();
    });
    await this.page.routeWebSocket(/\/hubs\/mission-control/, (ws) => {
      if (this.down) return void ws.close({ code: 4000, reason: 'Network down' });
      const server = ws.connectToServer();
      this.sockets.add(ws);
      ws.onClose(() => {
        this.sockets.delete(ws);
        void server.close();
      });
    });
  }

  /** The network drops: the open connection closes and every attempt is refused until `restore`. */
  async drop(): Promise<void> {
    this.down = true;
    await Promise.all([...this.sockets].map((ws) => ws.close({ code: 4000, reason: 'Network down' })));
    this.sockets.clear();
  }

  /** The network is back; the next attempt connects. */
  restore(): void {
    this.down = false;
  }

  /** Stops delaying the first connection. */
  answerAtOnce(): void {
    this.negotiateDelayMs = 0;
  }
}
