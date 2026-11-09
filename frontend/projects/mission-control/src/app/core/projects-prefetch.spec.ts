import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PROJECTS_API, ProjectSummary } from '@hewn/api';
import { firstValueFrom, of } from 'rxjs';
import { ProjectsPrefetch } from './projects-prefetch';

describe('ProjectsPrefetch', () => {
  const first = [{ id: 'a' }] as ProjectSummary[];
  const second = [{ id: 'b' }] as ProjectSummary[];
  let calls: number;

  beforeEach(() => {
    calls = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PROJECTS_API,
          useValue: { listProjects: () => of(++calls === 1 ? first : second) },
        },
      ],
    });
  });

  it('hands the list requested at start-up to the first load, then asks again', async () => {
    const prefetch = TestBed.inject(ProjectsPrefetch);
    prefetch.start();

    expect(await firstValueFrom(prefetch.list())).toBe(first);
    expect(await firstValueFrom(prefetch.list())).toBe(second);
    expect(calls).toBe(2);
  });

  it('asks the API when nothing was started', async () => {
    expect(await firstValueFrom(TestBed.inject(ProjectsPrefetch).list())).toBe(first);
    expect(calls).toBe(1);
  });
});
