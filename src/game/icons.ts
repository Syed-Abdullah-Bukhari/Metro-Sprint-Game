export type IconKind = 'magnet' | 'jetpack' | 'sneakers' | 'x2';

export const ICON_KINDS: IconKind[] = ['jetpack', 'magnet', 'sneakers', 'x2'];

export const ICON_COLORS: Record<IconKind, string> = {
  magnet: '#ff4d5e',
  jetpack: '#3bb8ff',
  sneakers: '#ffc933',
  x2: '#45e07a',
};

export const ICON_LABELS: Record<IconKind, string> = {
  magnet: 'Coin Magnet',
  jetpack: 'Jetpack',
  sneakers: 'Super Sneakers',
  x2: 'Score x2',
};

const GRADS: Record<IconKind, [string, string]> = {
  magnet: ['#ff8b96', '#d62639'],
  jetpack: ['#7fdcff', '#1672e0'],
  sneakers: ['#ffe27a', '#e58a00'],
  x2: ['#9bff98', '#16a34a'],
};

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Draws a round power-up badge on a canvas (used by both the 3D pickups and the HUD). */
export function drawBadge(kind: IconKind, size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.scale(size / 128, size / 128);

  const [a, b] = GRADS[kind];
  const grad = g.createLinearGradient(0, 8, 0, 120);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.beginPath();
  g.ellipse(64, 34, 38, 18, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fill();

  g.lineCap = 'round';
  g.lineJoin = 'round';

  switch (kind) {
    case 'magnet': {
      g.lineWidth = 18;
      g.strokeStyle = '#ffffff';
      g.lineCap = 'butt';
      g.beginPath();
      g.arc(64, 68, 24, 0, Math.PI, false);
      g.stroke();
      g.beginPath();
      g.moveTo(40, 68);
      g.lineTo(40, 40);
      g.moveTo(88, 68);
      g.lineTo(88, 40);
      g.stroke();
      g.fillStyle = '#26304d';
      g.fillRect(31, 33, 18, 15);
      g.fillRect(79, 33, 18, 15);
      break;
    }
    case 'jetpack': {
      g.fillStyle = '#ffffff';
      rr(g, 34, 26, 26, 56, 11);
      g.fill();
      rr(g, 68, 26, 26, 56, 11);
      g.fill();
      g.fillStyle = '#4b5b7a';
      g.fillRect(34, 44, 26, 7);
      g.fillRect(68, 44, 26, 7);
      g.fillStyle = '#ffb020';
      g.beginPath();
      g.moveTo(38, 86);
      g.lineTo(56, 86);
      g.lineTo(47, 112);
      g.closePath();
      g.moveTo(72, 86);
      g.lineTo(90, 86);
      g.lineTo(81, 112);
      g.closePath();
      g.fill();
      g.fillStyle = '#fff2a0';
      g.beginPath();
      g.moveTo(43, 86);
      g.lineTo(51, 86);
      g.lineTo(47, 100);
      g.closePath();
      g.moveTo(77, 86);
      g.lineTo(85, 86);
      g.lineTo(81, 100);
      g.closePath();
      g.fill();
      break;
    }
    case 'sneakers': {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(24, 82);
      g.lineTo(27, 46);
      g.quadraticCurveTo(29, 39, 38, 43);
      g.lineTo(54, 52);
      g.quadraticCurveTo(62, 62, 77, 66);
      g.quadraticCurveTo(100, 70, 104, 84);
      g.lineTo(24, 84);
      g.closePath();
      g.fill();
      g.fillStyle = '#26304d';
      rr(g, 22, 82, 84, 12, 5);
      g.fill();
      g.strokeStyle = '#e58a00';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(38, 74);
      g.quadraticCurveTo(58, 74, 78, 78);
      g.stroke();
      g.strokeStyle = '#26304d';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(44, 54);
      g.lineTo(52, 58);
      g.moveTo(51, 50);
      g.lineTo(59, 55);
      g.stroke();
      break;
    }
    case 'x2': {
      g.font = '900 58px "Fredoka", "Arial Black", Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 11;
      g.strokeStyle = '#0f6a32';
      g.strokeText('2x', 64, 68);
      g.fillStyle = '#ffffff';
      g.fillText('2x', 64, 68);
      break;
    }
  }
  return c;
}

const urlCache = new Map<IconKind, string>();

export function iconURL(kind: IconKind): string {
  let u = urlCache.get(kind);
  if (!u) {
    u = drawBadge(kind, 128).toDataURL('image/png');
    urlCache.set(kind, u);
  }
  return u;
}
