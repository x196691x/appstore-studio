import { useEffect, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import { Sparkles, Download, Settings2, Upload, X, Check, Smartphone, Tablet, ArrowUp, ArrowDown, Layers, ImagePlus, RotateCcw } from 'lucide-react';
import { initialProject, fonts, dimensions, activeVariant, type Project, type Format } from './model';
import { renderProject, fileToImage } from './render';

export default function App() {
  const [p, update] = useState<Project>(initialProject);
  const [ready, setReady] = useState(false), [saved, setSaved] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [settings, showSettings] = useState(false);
  const [url, setUrl] = useState(() => localStorage.getItem('studio-worker') || 'https://appstore-studio-api.dimarandom1337.workers.dev');
  const [token, setToken] = useState(''), [connected, setConnected] = useState(false);
  const [search, setSearch] = useState(''), [tab, setTab] = useState('design');
  const [rendering, setRendering] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), renderVersion = useRef(0), inFlight = useRef(false);
  const patch = (value: Partial<Project>) => { update(prev => ({ ...prev, ...value })); setError(''); };
  useEffect(() => { get<Project>('store-studio-project').then(value => { if (value && Array.isArray(value.variants)) update({ ...initialProject, ...value }); }).catch(() => setMessage('Локальное сохранение недоступно.')).finally(() => setReady(true)); }, []);
  useEffect(() => {
    if (!ready) return;
    setSaved(false);
    const timer = setTimeout(() => { set('store-studio-project', p).then(() => setSaved(true)).catch(() => setMessage('Не удалось сохранить проект: проверь свободное место в браузере.')); }, 600);
    return () => clearTimeout(timer);
  }, [p, ready]);
  useEffect(() => {
    const version = ++renderVersion.current;
    setRendering(true);
    const offscreen = document.createElement('canvas');
    renderProject(offscreen, p).then(() => { if (version !== renderVersion.current || !canvas.current) return; canvas.current.width = offscreen.width; canvas.current.height = offscreen.height; canvas.current.getContext('2d')!.drawImage(offscreen, 0, 0); }).catch(e => { if (version === renderVersion.current) setError(e.message); }).finally(() => { if (version === renderVersion.current) setRendering(false); });
  }, [p]);
  function endpoint() {
    let u: URL; try { u = new URL(url); } catch { throw new Error('Введи полный адрес Worker: https://имя.workers.dev'); }
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname))) throw new Error('Worker должен использовать HTTPS.');
    if (u.username || u.password) throw new Error('Адрес не должен содержать логин или пароль.');
    return u.origin;
  }
  async function checkConnection() {
    setError(''); setMessage('');
    try {
      const origin = endpoint();
      const r = await fetch(`${origin}/health`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Worker недоступен.');
      setConnected(true); localStorage.setItem('studio-worker', origin); setMessage(`Подключено · ${body.model}`); showSettings(false);
    } catch (e) { setConnected(false); setError(e instanceof Error ? e.message : 'Ошибка подключения.'); }
  }
  async function generate() {
    if (inFlight.current) return;
    if (!token || !url) { showSettings(true); return; }
    inFlight.current = true; setBusy(true); setError(''); setMessage('Генерация обычно занимает 1–3 минуты.');
    const snapshot = p;
    try {
      const r = await fetch(`${endpoint()}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt: snapshot.prompt, style: snapshot.style, format: snapshot.format, position: snapshot.position, mode: snapshot.mode, reference: snapshot.reference, ui: snapshot.ui }), signal: AbortSignal.timeout(300000) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Не удалось сгенерировать изображение.');
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(body.image)) throw new Error('Worker вернул неподдерживаемое изображение.');
      const variant = { id: crypto.randomUUID(), image: body.image, format: snapshot.format, position: snapshot.position, prompt: snapshot.prompt, created: Date.now(), cost: body.cost };
      update(prev => ({ ...prev, variants: [variant, ...prev.variants].slice(0, 12), activeId: variant.id }));
      setMessage(`Вариант готов${typeof body.cost === 'number' ? ` · $${body.cost.toFixed(3)}` : ''}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка генерации.'); setMessage(''); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function upload(file: File | undefined, target: 'ui' | 'reference' | 'background') {
    if (!file) return; setError('');
    try { const image = await fileToImage(file); if (target === 'background') { const v = { id: crypto.randomUUID(), image, format: p.format, position: p.position, prompt: 'Загруженное оформление', created: Date.now() }; update(prev => ({ ...prev, variants: [v, ...prev.variants].slice(0, 12), activeId: v.id })); } else patch({ [target]: image }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить файл.'); }
  }
  async function download() {
    setError('');
    try { const c = document.createElement('canvas'); await renderProject(c, p); const blob = await new Promise<Blob>((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('Ошибка экспорта.')), 'image/png')); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = `appstore-${p.format}-${dimensions[p.format].join('x')}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(href), 10000); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка экспорта.'); }
  }
  const chooseFormat = (format: Format) => patch({ format, activeId: p.variants.find(v => v.format === format)?.id || '' });
  const variant = activeVariant(p);
  const uploader = (target: 'reference' | 'ui', title: string, description: string) => <div className="upload-wrap"><label className={`upload ${p[target] ? 'has-image' : ''}`}>
    {p[target] ? <img src={p[target]} alt={title} /> : <ImagePlus size={22} />}
    <span><strong>{title}</strong><small>{p[target] ? 'Нажми, чтобы заменить' : description}</small></span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={title} onChange={e => { void upload(e.target.files?.[0], target); e.target.value = ''; }} />
  </label>{p[target] && <button className="remove" aria-label={`Удалить ${title}`} onClick={() => patch({ [target]: '' })}><X size={14}/></button>}</div>;
  return <div className="app">
    <header><a className="brand" href="#"><span className="brand-mark"><Layers size={22}/></span>store<span>studio</span><sup>BETA</sup></a><div className="header-right"><span className="save-state"><Check size={13}/>{saved ? 'Сохранено в браузере' : 'Локальный проект'}</span><button className="connection" onClick={() => showSettings(true)}><i className={connected ? 'online' : ''}/>{connected ? 'OpenRouter подключён' : 'Подключить AI'}<Settings2 size={15}/></button><button className="primary compact" onClick={download} disabled={rendering}><Download size={16}/>Скачать PNG</button></div></header>
    <div className="workspace"><aside className="controls"><div className="panel-heading"><span className="eyebrow">ТВОЯ СТУДИЯ</span><h1>Скриншот,<br/>который заметят.</h1><p>Твой интерфейс. Новый визуальный язык.</p></div>
      <div className="tabs"><button className={tab === 'design' ? 'selected' : ''} onClick={() => setTab('design')}>Оформление</button><button className={tab === 'text' ? 'selected' : ''} onClick={() => setTab('text')}>Заголовок</button></div>
      {tab === 'design' ? <><section><h2><span>01</span>Формат</h2><div className="format-options">{(['iphone','ipad'] as Format[]).map(f => <button key={f} className={p.format === f ? 'selected' : ''} onClick={() => chooseFormat(f)}>{f === 'iphone' ? <Smartphone size={21}/> : <Tablet size={21}/>}<strong>{f === 'iphone' ? 'iPhone' : 'iPad'}</strong><small>{dimensions[f].join(' × ')}</small></button>)}</div></section>
      <section><h2><span>02</span>Материалы</h2>{uploader('reference','Референс оформления','Стиль, цвета и композиция')}{uploader('ui','UI приложения','PNG, JPEG или WebP · до 15 МБ')}<label className="field-label">Работа с интерфейсом<select value={p.mode} onChange={e => patch({ mode: e.target.value as Project['mode'] })}><option value="full">Вся графика с помощью AI</option><option value="preserve">Оригинальный UI поверх AI-фона</option></select></label><p className="hint">{p.mode === 'full' ? 'AI использует UI как референс. Мелкие детали могут измениться.' : 'Исходный UI накладывается без перерисовки.'}</p>{p.mode === 'preserve' && <label className="field-label">Размер UI <b>{p.uiScale}%</b><input type="range" min="35" max="95" value={p.uiScale} onChange={e => patch({uiScale:+e.target.value})}/></label>}</section>
      <section><h2><span>03</span>Визуальный стиль</h2><div className="styles">{['Мягкие 3D-формы','Минимализм','Яркий градиент','Тёмный премиум'].map((style,i) => <button key={style} className={p.style === style ? 'selected' : ''} onClick={() => patch({style})}><i className={`swatch swatch-${i}`}/>{style}</button>)}</div><label className="field-label">Что создаём?<textarea rows={3} placeholder="Например: приложение для медитации, мягкий свет, лавандовые оттенки…" value={p.prompt} maxLength={2000} onChange={e => patch({prompt:e.target.value})}/></label><label className="field-label">Место для заголовка<div className="segmented"><button className={p.position === 'top' ? 'selected' : ''} onClick={() => patch({position:'top'})}><ArrowUp size={15}/>Сверху</button><button className={p.position === 'bottom' ? 'selected' : ''} onClick={() => patch({position:'bottom'})}><ArrowDown size={15}/>Снизу</button></div></label></section></> : <><section><h2><span>01</span>Текст</h2><label className="field-label">Заголовок<textarea rows={4} value={p.title} maxLength={250} onChange={e => patch({title:e.target.value})}/></label><label className="field-label">Размер <b>{p.fontSize} px</b><input type="range" min="32" max="180" value={p.fontSize} onChange={e => patch({fontSize:+e.target.value})}/></label><div className="two-fields"><label className="field-label">Цвет<input type="color" value={p.color} onChange={e => patch({color:e.target.value})}/></label><label className="field-label">Выравнивание<select value={p.align} onChange={e => patch({align:e.target.value as Project['align']})}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label></div><div className="segmented"><button className={p.position === 'top' ? 'selected' : ''} onClick={() => patch({position:'top'})}>Сверху</button><button className={p.position === 'bottom' ? 'selected' : ''} onClick={() => patch({position:'bottom'})}>Снизу</button></div><label className="field-label">Боковые отступы <b>{p.padding}%</b><input type="range" min="3" max="18" value={p.padding} onChange={e => patch({padding:+e.target.value})}/></label><label className="field-label">Затемнение под текстом <b>{p.shade}%</b><input type="range" min="0" max="85" value={p.shade} onChange={e => patch({shade:+e.target.value})}/></label></section><section><h2><span>02</span>Каталог шрифтов</h2><input placeholder="Найти шрифт…" aria-label="Поиск шрифта" value={search} onChange={e => setSearch(e.target.value)}/><div className="font-list">{fonts.filter(f => f.toLowerCase().includes(search.toLowerCase())).map(f => <button key={f} className={p.font === f ? 'selected' : ''} onClick={() => patch({font:f})}><span>{f}</span><strong style={{fontFamily:`"${f} Variable"`}}>Большие идеи. Aa</strong>{p.font === f && <Check size={16}/>}</button>)}</div><p className="hint">7 шрифтов с кириллицей. Загружены вместе с сайтом.</p></section></>}
      <div className="generate-area"><button className="primary generate" onClick={generate} disabled={busy}><Sparkles size={18} className={busy ? 'spin' : ''}/>{busy ? 'Создаём оформление…' : 'Сгенерировать скриншот'}</button><small>Текст можно менять без новой генерации</small></div>
    </aside><main><div className="canvas-toolbar"><div><span className="eyebrow">ХОЛСТ / 01</span><h2>{p.format === 'iphone' ? 'iPhone' : 'iPad'} screenshot</h2></div><span className="dimension-tag">{dimensions[p.format].join(' × ')} px</span></div>
      {(error || message) && <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}<button aria-label="Скрыть уведомление" onClick={() => {setError('');setMessage('');}}><X size={15}/></button></div>}
      <div className={`stage ${p.format}`}><div className="canvas-frame"><canvas ref={canvas} aria-label="Предпросмотр скриншота"/>{busy && <div className="generating-overlay"><Sparkles size={30} className="spin"/><strong>Создаём новый визуал</strong><span>Можно продолжать редактировать текст</span></div>}</div></div><div className="preview-note"><span className="dot"/>{variant ? 'Готово к экспорту' : 'Демо-оформление · сгенерируй свой вариант'}<span>PNG · точный размер</span></div>
      <div className="bottom-card"><Sparkles size={20}/><div><strong>Сначала визуал. Затем твои слова.</strong><p>Заголовок — отдельный слой. Меняй его сколько угодно.</p></div><button onClick={() => setTab('text')}>Редактировать текст ↗</button></div>
    </main><aside className="history"><div className="history-heading"><h2>Варианты</h2><span>{p.variants.length.toString().padStart(2,'0')}</span></div><p>Найди свой лучший визуал</p><div className="variant-list">{p.variants.filter(v => v.format === p.format).map((v,i) => <button key={v.id} className={`variant ${v.id === p.activeId ? 'selected' : ''}`} onClick={() => patch({activeId:v.id})}><img src={v.image} alt={`Вариант ${i+1}`}/><span>{i === 0 ? 'Последний' : `Вариант ${i+1}`}<small>{new Date(v.created).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</small></span>{v.id === p.activeId && <i><Check size={12}/></i>}</button>)}{!p.variants.some(v => v.format === p.format) && <div className="empty-history"><Layers size={30}/><strong>Место для идей</strong><p>Здесь появятся сгенерированные варианты.</p></div>}</div><label className="import-background"><Upload size={16}/>Загрузить готовый фон<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Загрузить готовый фон" onChange={e => {void upload(e.target.files?.[0],'background'); e.target.value='';}}/></label><button className="demo-reset" onClick={() => patch({activeId:''})}><RotateCcw size={14}/>Показать демо</button><div className="local-note"><span>ТОЛЬКО НА ЭТОМ УСТРОЙСТВЕ</span><p>Проект и последние 12 вариантов сохраняются в твоём браузере.</p></div></aside></div>
    {settings && <div className="modal-backdrop" onClick={() => showSettings(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="connection-title" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Закрыть настройки" onClick={() => showSettings(false)}><X size={20}/></button><span className="brand-mark"><Settings2 size={22}/></span><h2 id="connection-title">Подключить генерацию</h2><p>OpenRouter работает через твой Cloudflare Worker. API-ключ остаётся на стороне Cloudflare.</p><label className="field-label">Адрес Worker<input placeholder="https://appstore-studio-api.…workers.dev" value={url} onChange={e => {setUrl(e.target.value);setConnected(false);}}/></label><label className="field-label">Код доступа<input type="password" autoComplete="off" placeholder="Код из секрета STUDIO_ACCESS_TOKEN" value={token} onChange={e => {setToken(e.target.value);setConnected(false);}}/></label><p className="hint">Код хранится только в памяти этой страницы. После перезагрузки введи его снова.</p>{error && <div className="notice error" role="alert">{error}</div>}<button className="primary" onClick={checkConnection}>Проверить и подключить</button><p className="hint">До подключения доступны редактор, загрузка фона и экспорт PNG.</p></div></div>}
  </div>;
}
