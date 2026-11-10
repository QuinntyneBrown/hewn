import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@hewn/components';
import { playerTime, playerValueText } from './increment-view';

/**
 * The increment's captioned walkthrough (L2-023 AC2), played from the API in the design system's video player: the
 * current caption over the picture, play and pause, the time, a seek slider (arrow keys move 5 s, Home and End),
 * a captions toggle and full screen.
 */
@Component({
  selector: 'hw-increment-video',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './increment-video.component.html',
})
export class IncrementVideoComponent {
  readonly src = input.required<string>();
  readonly captions = input.required<string>();
  /** The video's folder in the repository, as the PR body links it. */
  readonly folder = input<string | null>(null);
  readonly title = input('');

  private readonly media = viewChild.required<ElementRef<HTMLVideoElement>>('media');
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');

  protected readonly playing = signal(false);
  protected readonly current = signal(0);
  protected readonly total = signal(0);
  protected readonly captionsOn = signal(true);
  protected readonly cue = signal('');

  protected readonly time = playerTime;
  protected readonly round = Math.round;
  protected readonly percent = computed(() =>
    this.total() > 0 ? Math.min(100, (this.current() / this.total()) * 100) : 0,
  );
  protected readonly valueText = computed(() => playerValueText(this.current(), this.total()));

  protected loaded(): void {
    const video = this.media().nativeElement;
    this.total.set(Number.isFinite(video.duration) ? video.duration : 0);
    // Captions are drawn over the picture by the player, so the browser's own rendering stays hidden.
    const track = video.textTracks[0];
    if (track) {
      track.mode = 'hidden';
      track.oncuechange = () => this.showCue();
    }
  }

  protected tick(): void {
    this.current.set(this.media().nativeElement.currentTime);
  }

  protected toggle(): void {
    const video = this.media().nativeElement;
    if (video.paused || video.ended) void video.play();
    else video.pause();
  }

  protected toggleCaptions(): void {
    this.captionsOn.update((on) => !on);
  }

  protected seekTo(seconds: number): void {
    const video = this.media().nativeElement;
    const to = Math.max(0, Math.min(seconds, this.total()));
    video.currentTime = to;
    this.current.set(to);
  }

  protected seekClick(event: MouseEvent): void {
    const track = event.currentTarget as HTMLElement;
    const box = track.getBoundingClientRect();
    if (box.width > 0) this.seekTo(((event.clientX - box.left) / box.width) * this.total());
  }

  protected seekKey(event: KeyboardEvent): void {
    const steps: Record<string, number> = {
      ArrowRight: 5,
      ArrowUp: 5,
      ArrowLeft: -5,
      ArrowDown: -5,
    };
    if (event.key in steps) this.seekTo(this.current() + steps[event.key]!);
    else if (event.key === 'Home') this.seekTo(0);
    else if (event.key === 'End') this.seekTo(this.total());
    else return;
    event.preventDefault();
  }

  protected fullScreen(): void {
    void this.frame().nativeElement.requestFullscreen?.();
  }

  private showCue(): void {
    const cues = this.media().nativeElement.textTracks[0]?.activeCues;
    const texts: string[] = [];
    for (let i = 0; cues && i < cues.length; i++) texts.push((cues[i] as VTTCue).text);
    this.cue.set(texts.join('\n'));
  }
}
