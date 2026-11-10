import type { Locator, Page } from '@playwright/test';

/**
 * The sign-in page (/sign-in) in every state, the e2e stack's fake GitHub authorize page it hands over to, and the
 * sidebar's Sign out button. Owns every selector for them.
 */
export class SignInPage {
  readonly heading: Locator;
  readonly center: Locator;
  readonly continueWithGitHub: Locator;
  readonly tryAgainWithGitHub: Locator;
  readonly waitingForGitHub: Locator;
  readonly alert: Locator;
  readonly status: Locator;
  readonly allowListNote: Locator;
  readonly pipeline: Locator;
  readonly signOut: Locator;
  readonly gitHubLogin: Locator;
  readonly gitHubAuthorize: Locator;
  readonly gitHubCancel: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: /Give it a direction/ });
    this.center = page.locator('.auth__center');
    this.continueWithGitHub = page.getByRole('link', { name: 'Continue with GitHub' });
    this.tryAgainWithGitHub = page.getByRole('link', { name: 'Try again with GitHub' });
    this.waitingForGitHub = page.getByRole('button', { name: 'Waiting for GitHub…' });
    this.alert = this.center.getByRole('alert');
    this.status = this.center.getByRole('status');
    this.allowListNote = page.getByText('Only GitHub accounts on the allow list can sign in.');
    this.pipeline = page.getByRole('complementary', { name: 'The pipeline' }).getByRole('listitem');
    this.signOut = page.locator('.sidebar__foot').getByRole('button', { name: 'Sign out' });
    this.gitHubLogin = page.getByLabel('GitHub login');
    this.gitHubAuthorize = page.getByRole('button', { name: 'Authorize' });
    this.gitHubCancel = page.getByRole('link', { name: 'Cancel' });
  }

  /** Opens sign-in with the query the API or the app sends people with, e.g. `error=denied&login=devon-park`. */
  async open(query = ''): Promise<void> {
    await this.page.goto(`/sign-in${query ? `?${query}` : ''}`);
    await this.heading.waitFor();
  }

  /** Signs in on the fake GitHub page as `login`, as a person would on GitHub's authorize page. */
  async authorizeOnGitHub(login: string): Promise<void> {
    await this.gitHubLogin.fill(login);
    await this.gitHubAuthorize.click();
  }

  /** Keeps the browser on sign-in after "Continue with GitHub", so the waiting state can be seen. */
  async holdGitHub(): Promise<void> {
    await this.page.evaluate(() =>
      document.addEventListener('click', (event) => {
        if ((event.target as Element).closest('a.auth__btn')) event.preventDefault();
      }),
    );
  }

  /** Whether the API still accepts the browser's session. */
  async apiAcceptsSession(): Promise<boolean> {
    return (await this.page.request.get('/api/me')).ok();
  }
}
