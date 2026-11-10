import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  busyLabel,
  connectedFor,
  notCreated,
  notRevoked,
  seenAgo,
  startCommand,
  stopDialogText,
  stoppedBanner,
  unconfirmed,
  workerActivity,
  workerStatus,
} from './workers-text';

const worker = (name: string, project: string | null, online = true) => ({
  name,
  online,
  workingOn: project ? { projectName: project } : null,
});

describe('stopDialogText', () => {
  it('names the online workers and the projects that keep their checkpoints', () => {
    expect(
      stopDialogText([
        worker('quinn-mbp.local', 'Ledgerline'),
        worker('hewn-cloud-eus-01', 'Tidewater'),
        worker('hewn-cloud-eus-02', null),
        worker('build-box-02', null, false),
      ]),
    ).toBe(
      'All 3 online workers halt their active runs within 10 seconds and stop leasing. Ledgerline and Tidewater keep their last checkpoints and resume from them when you start workers again.',
    );
  });

  it('speaks of one worker and one project in the singular', () => {
    expect(stopDialogText([worker('quinn-mbp.local', 'Ledgerline')])).toBe(
      'The online worker halts its active run within 10 seconds and stops leasing. Ledgerline keeps its last checkpoint and resumes from it when you start workers again.',
    );
  });

  it('still stops leasing when nothing is running', () => {
    expect(stopDialogText([worker('quinn-mbp.local', null, false)])).toBe(
      'No worker is online. Leasing stops, so nothing new starts until you start workers again.',
    );
  });
});

describe('stoppedBanner', () => {
  it('says who stopped the workers and when', () => {
    expect(
      stoppedBanner(
        { stopped: true, changedBy: 'quinntynebrown', changedAt: '2026-11-09T08:30:00Z' },
        'UTC',
      ),
    ).toBe(
      'All workers stopped by quinntynebrown at 08:30. Nothing new will be leased until you start them again.',
    );
  });
});

describe('unconfirmed', () => {
  it('names the worker that didn’t confirm and says the others stopped', () => {
    expect(unconfirmed(['hewn-cloud-eus-01'], 3)).toEqual({
      title: '1 worker didn’t confirm',
      body: 'hewn-cloud-eus-01 didn’t acknowledge within 10 s. The others stopped. Leasing is off, so it can’t pick up new work; try again to stop it.',
    });
  });

  it('speaks of several workers in the plural, and of no others when none stopped', () => {
    expect(unconfirmed(['a', 'b'], 2)).toEqual({
      title: '2 workers didn’t confirm',
      body: 'a and b didn’t acknowledge within 10 s. Leasing is off, so they can’t pick up new work; try again to stop them.',
    });
  });
});

describe('busyLabel', () => {
  it('counts the workers being stopped', () => {
    expect(busyLabel(3)).toBe('Stopping 3 workers…');
    expect(busyLabel(1)).toBe('Stopping 1 worker…');
  });
});

describe('workers page text', () => {
  const now = Date.parse('2026-11-09T10:00:00Z');

  it('shows the status with a label, never colour alone', () => {
    expect(workerStatus('Busy')).toEqual({ label: 'Leased', tone: 'run', icon: 'spinner' });
    expect(workerStatus('Idle')).toEqual({ label: 'Idle', tone: 'idle', icon: 'idleCircle' });
    expect(workerStatus('Offline')).toEqual({ label: 'Offline', tone: 'fail', icon: 'wifiOff' });
  });

  it('says what each worker is doing', () => {
    expect(workerActivity({ status: 'Busy', holding: false })).toBeNull();
    expect(workerActivity({ status: 'Idle', holding: true })).toBe('Holding at checkpoint');
    expect(workerActivity({ status: 'Idle', holding: false })).toBe('Waiting for work');
    expect(workerActivity({ status: 'Offline', holding: false })).toBe('Lease released');
  });

  it('shows the last heartbeat and how long a worker has been connected', () => {
    expect(seenAgo('2026-11-09T09:59:57Z', now)).toBe('3s ago');
    expect(seenAgo('2026-11-09T09:56:00Z', now)).toBe('4m ago');
    expect(seenAgo('2026-11-09T07:00:00Z', now)).toBe('3h ago');
    expect(connectedFor('2026-11-09T07:46:00Z', now)).toBe('2h 14m');
    expect(connectedFor('2026-11-09T09:22:00Z', now)).toBe('38m');
    expect(connectedFor('2026-11-09T04:58:00Z', now)).toBe('5h 02m');
  });
});

describe('startCommand', () => {
  it('starts the worker image against this API with the new token, one option per line', () => {
    expect(startCommand('https://hewn.example', 'hwt_abc')).toBe(
      [
        'docker run -d --name hewn-worker \\',
        '  -e HEWN_API_URL=https://hewn.example \\',
        '  -e HEWN_WORKER_TOKEN=hwt_abc \\',
        '  hewn-worker',
      ].join('\n'),
    );
  });
});

describe('notCreated', () => {
  it('gives the status the API answered, and says nothing was saved', () => {
    expect(notCreated(new HttpErrorResponse({ status: 500 }))).toBe(
      'The API returned 500. Nothing was saved; try again.',
    );
  });

  it('says the API could not be reached when there was no answer', () => {
    expect(notCreated(new HttpErrorResponse({ status: 0 }))).toBe(
      'Hewn couldn’t reach the API. Nothing was saved; try again.',
    );
  });
});

describe('notRevoked', () => {
  it('says the worker can still register, with the status the API answered', () => {
    expect(notRevoked('build-box-02', new HttpErrorResponse({ status: 500 }))).toBe(
      'The API returned 500. build-box-02 can still register; try again.',
    );
  });

  it('explains that a worker on the configured development token is stopped in the API’s configuration', () => {
    expect(notRevoked('dev-box', new HttpErrorResponse({ status: 409 }))).toBe(
      'dev-box uses the development token set in the API’s configuration; remove HEWN_WORKER_TOKEN there to stop it.',
    );
  });
});
