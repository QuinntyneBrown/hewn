/** The ten entries pages/audit/default.html shows, newest first, in UTC, and its four projects. */
const ids = {
  ledgerline: '00000000-0000-4000-8000-000000000201',
  tidewater: '00000000-0000-4000-8000-000000000202',
  northwind: '00000000-0000-4000-8000-000000000203',
  harbor: '00000000-0000-4000-8000-000000000204',
};

const entry = (
  id: number,
  at: string,
  actor: string,
  action: string,
  projectId: string | null,
  target: string | null,
  ipAddress: string | null,
) => ({ id, at, actor, action, projectId, target, ipAddress });

export const mockAuditLog = {
  entries: [
    entry(10, '2026-11-09T14:31:07Z', 'quinntynebrown', 'Merge', ids.ledgerline, 'Ledgerline #27', null),
    entry(9, '2026-11-09T13:02:44Z', 'quinntynebrown', 'Resume', ids.tidewater, 'Tidewater', '24.114.38.91'),
    entry(8, '2026-11-09T12:58:10Z', 'quinntynebrown', 'Pause', ids.tidewater, 'Tidewater', '24.114.38.91'),
    entry(7, '2026-11-09T10:15:22Z', 'ama-osei', 'SignIn', null, null, '99.230.12.4'),
    entry(6, '2026-11-09T09:40:03Z', 'quinntynebrown', 'TokenCreated', null, 'hewn-cloud-eus-02', '24.114.38.91'),
    entry(
      5,
      '2026-11-08T18:22:51Z',
      'quinntynebrown',
      'DirectionSubmitted',
      ids.northwind,
      'Northwind Ops',
      '24.114.38.91',
    ),
    entry(4, '2026-11-08T17:01:36Z', 'quinntynebrown', 'Cancel', ids.harbor, 'Harbor CRM', '24.114.38.91'),
    entry(3, '2026-11-08T16:44:19Z', 'quinntynebrown', 'TokenRevoked', null, 'build-box-01', '24.114.38.91'),
    entry(2, '2026-11-08T08:34:12Z', 'quinntynebrown', 'StartWorkers', null, 'All projects', '24.114.38.91'),
    entry(1, '2026-11-08T08:30:00Z', 'quinntynebrown', 'StopAll', null, 'All projects', '24.114.38.91'),
  ],
  projects: [
    { id: ids.ledgerline, name: 'Ledgerline' },
    { id: ids.tidewater, name: 'Tidewater' },
    { id: ids.northwind, name: 'Northwind Ops' },
    { id: ids.harbor, name: 'Harbor CRM' },
  ],
  next: null,
};

export const mockAuditProjects = ids;
