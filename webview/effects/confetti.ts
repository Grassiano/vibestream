interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  // Flutter physics
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmplitude: number;
  drag: number;
  // 3D-like flip
  flipAngle: number;
  flipSpeed: number;
}

const COLORS = ['#e94560', '#ffd700', '#00d2ff', '#7cff6b', '#ff6bff', '#ff9f43'];
const GRAVITY = 0.08;
const AIR_RESISTANCE = 0.985;

export class ConfettiSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  burst(count = 30): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      const isRectangle = Math.random() > 0.3;

      this.particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        width: isRectangle ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
        height: isRectangle ? 5 + Math.random() * 6 : 2 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 80 + Math.random() * 50,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 2 + Math.random() * 3,
        wobbleAmplitude: 0.5 + Math.random() * 1.5,
        drag: 0.97 + Math.random() * 0.025,
        flipAngle: Math.random() * Math.PI * 2,
        flipSpeed: 0.05 + Math.random() * 0.15,
      });
    }

    if (!this.animationId) {
      this.animate();
    }
  }

  private animate = (): void => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;

      // Physics update
      p.vy += GRAVITY;
      p.vx *= p.drag;
      p.vy *= AIR_RESISTANCE;

      // Flutter — lateral wobble that increases as particle falls
      const wobble = Math.sin(p.life * 0.1 * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmplitude;
      p.x += p.vx + wobble;
      p.y += p.vy;

      // Rotation
      p.rotation += p.rotationSpeed;
      p.rotationSpeed *= 0.995; // slow down rotation over time

      // 3D flip
      p.flipAngle += p.flipSpeed;

      p.life++;

      // Fade out in last 30% of life
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio >= 1) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = lifeRatio > 0.7
        ? 1 - (lifeRatio - 0.7) / 0.3
        : 1;

      // 3D flip effect — scale width by cos of flip angle
      const flipScale = Math.abs(Math.cos(p.flipAngle));
      const drawWidth = p.width * Math.max(flipScale, 0.15);

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-drawWidth / 2, -p.height / 2, drawWidth, p.height);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.animationId = null;
    }
  };

  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.particles = [];
  }
}
