import { ensureFont, fontFamily, fontWeight } from './fonts';
import { activeVariant, dimensions, linesForText, type Project } from './model';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@fontsource-variable/montserrat';
import '@fontsource-variable/oswald';
import '@fontsource-variable/roboto';
import '@fontsource-variable/nunito-sans';
import '@fontsource-variable/playfair-display';
const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string) {
  let promise = images.get(src);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Не удалось открыть изображение.')); img.src = src; });
    if (images.size > 24) images.clear();
    images.set(src, promise);
  }
  return promise;
}
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
}
function demo(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#171717'); g.addColorStop(.5, '#666666'); g.addColorStop(1, '#cfcfcf');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(w * .53, h * .62); ctx.rotate(-.35);
  for (let i = 9; i >= 0; i--) {
    const x = (i - 5) * w * .035; const y = (i - 5) * h * .035;
    const r = ctx.createLinearGradient(-w * .4, -h * .18, w * .4, h * .18);
    r.addColorStop(0, '#d6d6d6'); r.addColorStop(.46, '#f0f0f0'); r.addColorStop(.55, '#aaaaaa'); r.addColorStop(1, '#666666');
    ctx.fillStyle = r; ctx.shadowColor = '#00000055'; ctx.shadowBlur = w * .035; ctx.shadowOffsetY = h * .012;
    ctx.beginPath(); ctx.roundRect(-w * .35 + x, -h * .12 + y, w * .7, h * .25, w * .18); ctx.fill();
  }
  ctx.restore();
}
export async function renderProject(canvas: HTMLCanvasElement, p: Project) {
  const [w, h] = dimensions[p.format];
  const temp = document.createElement('canvas'); temp.width = w; temp.height = h;
  const ctx = temp.getContext('2d')!;
  const variant = activeVariant(p);
  const [bg, ui] = await Promise.all([variant ? loadImage(variant.image) : null, p.mode === 'preserve' && p.ui ? loadImage(p.ui) : null]);
  if (bg) cover(ctx, bg, w, h); else demo(ctx, w, h);
  const band = ctx.createLinearGradient(0, p.position === 'top' ? 0 : h, 0, p.position === 'top' ? h * .42 : h * .58);
  band.addColorStop(0, `rgba(10,9,25,${p.shade / 100})`); band.addColorStop(1, 'rgba(10,9,25,0)');
  ctx.fillStyle = band; ctx.fillRect(0, 0, w, h);
  if (ui) {
    const scale = Math.min(w * p.uiScale / 100 / ui.width, h * .62 / ui.height);
    const uw = ui.width * scale, uh = ui.height * scale;
    const ux = (w - uw) / 2, uy = p.position === 'top' ? h * .93 - uh : h * .07;
    ctx.save(); ctx.shadowColor = '#00000055'; ctx.shadowBlur = w * .05; ctx.shadowOffsetY = h * .018;
    ctx.fillStyle = '#17171d'; ctx.beginPath(); ctx.roundRect(ux - w * .014, uy - w * .014, uw + w * .028, uh + w * .028, w * .045); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.beginPath(); ctx.roundRect(ux, uy, uw, uh, w * .032); ctx.clip(); ctx.drawImage(ui, ux, uy, uw, uh); ctx.restore();
  }
  const fontSize = p.fontSize * w / 1242;
  await ensureFont(p.font);
  const font = `${fontWeight(p.font)} ${fontSize}px "${fontFamily(p.font)}"`;
  await document.fonts.load(font, p.title || 'Аа');
  ctx.font = font; ctx.textBaseline = 'top'; ctx.textAlign = p.align; ctx.fillStyle = p.color;
  const pad = w * p.padding / 100, maxWidth = w - 2 * pad;
  const lines = linesForText(ctx, p.title, maxWidth), lineHeight = fontSize * 1.16;
  const textHeight = lines.length * lineHeight;
  if (textHeight > h * .4) throw new Error('Заголовок занимает больше 40% скриншота. Уменьши размер или сократи текст.');
  const y = p.position === 'top' ? h * .07 : h * .93 - textHeight;
  const x = p.align === 'left' ? pad : p.align === 'right' ? w - pad : w / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  canvas.width = w; canvas.height = h; canvas.getContext('2d')!.drawImage(temp, 0, 0);
}
export async function fileToImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Поддерживаются PNG, JPEG и WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Изображение должно быть меньше 15 МБ.');
  const src = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Не удалось прочитать файл.')); r.readAsDataURL(file); });
  const img = await loadImage(src), scale = Math.min(1, 2048 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale); c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
