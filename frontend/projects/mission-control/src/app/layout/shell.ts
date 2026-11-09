import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent, IconName } from '@hewn/components';
import { SessionStore } from '../core/session-store';
import { ToastRegionComponent } from './toast-region';
import { WordmarkComponent } from './wordmark';

interface NavItem {
  label: string;
  link: string;
  icon: IconName;
}

/** Sidebar, top bar and main region shared by every signed-in page. */
@Component({
  selector: 'hw-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    WordmarkComponent,
    ToastRegionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class ShellComponent {
  protected readonly session = inject(SessionStore);

  protected readonly nav: NavItem[] = [
    { label: 'Dashboard', link: '/dashboard', icon: 'dashboard' },
    { label: 'Projects', link: '/projects', icon: 'projects' },
    { label: 'Workers', link: '/workers', icon: 'workers' },
    { label: 'Audit', link: '/audit', icon: 'audit' },
    { label: 'Settings', link: '/settings', icon: 'settings' },
  ];

  protected readonly initials = computed(() =>
    (this.session.me()?.login ?? '?').slice(0, 2).toUpperCase(),
  );
}
