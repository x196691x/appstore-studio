export type Format = 'iphone' | 'ipad';
export type Position = 'top' | 'bottom';
export type Variant = { id: string; image: string; format: Format; position: Position; prompt: string; created: number; cost?: number };
export type Project = {
  title: string; format: Format; font: string; fontSize: number; color: string;
  position: Position; align: 'left' | 'center' | 'right'; padding: number;
  prompt: string; style: string; reference: string; ui: string; mode: 'full' | 'preserve';
  uiScale: number; variants: Variant[]; activeId: string; shade: number;
};
export const dimensions = { iphone: [1242, 2688], ipad: [2048, 2732] } as const;
export const fonts = ['Manrope', 'Inter', 'Montserrat', 'Oswald', 'Roboto', 'Nunito Sans', 'Playfair Display'];
export const initialProject: Project = {
  title: 'Большие идеи.\nКрасивый старт.', format: 'iphone', font: 'Manrope', fontSize: 96,
  color: '#ffffff', position: 'top', align: 'center', padding: 7, prompt: '',
  style: 'Мягкие 3D-формы', reference: '', ui: '', mode: 'full', uiScale: 76,
  variants: [], activeId: '', shade: 15,
};
export function activeVariant(p: Project) { return p.variants.find(v => v.id === p.activeId && v.format === p.format); }
export function linesForText(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      let part = '';
      for (const char of word) {
        if (part && ctx.measureText(part + char).width > width) { lines.push(part); part = ''; }
        part += char;
      }
      line = part;
    }
    lines.push(line);
  }
  return lines;
}
