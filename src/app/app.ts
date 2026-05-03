import { ChangeDetectionStrategy, Component, ElementRef, HostListener, signal, viewChild, afterNextRender, computed } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  srcVideo = viewChild<ElementRef<HTMLVideoElement>>('srcVideo');
  videoCanvas = viewChild<ElementRef<HTMLCanvasElement>>('videoCanvas');
  scrubSection = viewChild<ElementRef<HTMLElement>>('scrubSection');

  progress = signal(0);
  revealed = signal(false);
  targetTime = signal(0);
  videoReady = signal(false);
  seeking = false;

  hintOpacity = computed(() => this.progress() > 0.01 ? '0' : '1');
  counterOpacity = computed(() => this.progress() > 0.01 ? '1' : '0');

  formattedTime = computed(() => {
    const t = this.targetTime();
    if (isNaN(t) || !isFinite(t)) return '00:00';
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  constructor() {
    afterNextRender({
      write: () => {
         this.initVideo();
         this.resize();
      }
    });
  }

  initVideo() {
    const video = this.srcVideo()?.nativeElement;
    if (!video) return;

    video.addEventListener('seeked', () => {
      this.seeking = false;
      this.drawFrame();
    });

    const onReady = () => {
      this.videoReady.set(true);
      video.currentTime = video.duration || 0;
      this.drawFrame();
      this.resize();
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);

    video.load();
  }

  @HostListener('window:resize')
  resize() {
    const canvas = this.videoCanvas()?.nativeElement;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (this.videoReady()) this.drawFrame();
  }

  drawFrame() {
    if (!this.videoReady()) return;
    const video = this.srcVideo()?.nativeElement;
    const canvas = this.videoCanvas()?.nativeElement;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / vw, ch / vh);
    const w = vw * scale, h = vh * scale;
    const x = (cw - w) / 2, y = (ch - h) / 2;
    ctx.drawImage(video, x, y, w, h);
  }

  @HostListener('window:scroll')
  onScroll() {
    if (!this.videoReady()) return;
    const scrub = this.scrubSection()?.nativeElement;
    const video = this.srcVideo()?.nativeElement;

    if (!scrub || !video) return;

    const scrubTop = scrub.getBoundingClientRect().top + window.scrollY;
    const scrollRange = Math.max(1, scrub.offsetHeight - window.innerHeight);
    const scrolled = window.scrollY - scrubTop;
    const newProgress = Math.max(0, Math.min(1, scrolled / scrollRange));

    this.progress.set(newProgress);

    const duration = isNaN(video.duration) ? 0 : video.duration;
    const tTime = duration * (1 - newProgress);
    this.targetTime.set(tTime);

    if (!this.seeking && Math.abs(tTime - video.currentTime) > 0.04) {
      this.seeking = true;
      video.currentTime = tTime;
    }

    if (newProgress >= 0.98 && !this.revealed()) {
      this.revealed.set(true);
    }
    if (newProgress < 0.95 && this.revealed()) {
      this.revealed.set(false);
    }
  }
}