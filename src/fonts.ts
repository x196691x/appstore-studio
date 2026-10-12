import { fonts as bundled } from './model';
export const googleFonts = ['Alegreya','Alegreya Sans','Arimo','Arsenal','Bitter','Caveat','Comfortaa','Cormorant Garamond','Cuprum','Exo 2','Fira Sans','Golos Text','IBM Plex Sans','IBM Plex Serif','Jost','Literata','Lora','Merriweather','Noto Sans','Noto Serif','Open Sans','PT Sans','PT Serif','Philosopher','Play','Raleway','Roboto Condensed','Roboto Slab','Rubik','Russo One','Source Sans 3','Source Serif 4','Spectral','Ubuntu','Vollkorn','Yanone Kaffeesatz'];
// Russo One only has a regular face. All other curated families include 700.
const loadedWeights = new Map<string, number>();
export function fontWeight(family: string) { return loadedWeights.get(family) ?? (family === 'Russo One' ? 400 : 700); }
export function fontFamily(family: string) { return bundled.includes(family) ? `${family} Variable` : family; }
const pending = new Map<string, Promise<void>>();
export function ensureFont(family: string) {
  if (!/^[\p{L}\p{N} -]{1,80}$/u.test(family)) return Promise.reject(new Error('Введи название семейства Google Fonts, например Lora.'));
  if (bundled.includes(family)) return document.fonts.load(`700 96px "${fontFamily(family)}"`,'Большие идеи Aa').then(() => {});
  let promise = pending.get(family);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      let link: HTMLLinkElement | undefined;
      const timer = setTimeout(fail, 20000);
      function fail() { clearTimeout(timer); link?.remove(); pending.delete(family); reject(new Error(`Не удалось загрузить «${family}» из Google Fonts. Проверь название и доступ к Google.`)); }
      function attempt(weight: number) {
        link?.remove();
        const sheet = document.createElement('link'); link = sheet; sheet.rel = 'stylesheet';
        sheet.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}&display=swap`;
        const retry = () => weight === 700 ? attempt(400) : fail();
        sheet.onerror = retry;
        sheet.onload = () => { document.fonts.load(`${weight} 96px "${family}"`, 'Большие идеи Aa').then(faces => { if (!faces.length) { retry(); return; } clearTimeout(timer); loadedWeights.set(family, weight); resolve(); }, retry); };
        document.head.appendChild(sheet);
      }
      attempt(fontWeight(family));
    }); pending.set(family,promise);
  }
  return promise;
}
