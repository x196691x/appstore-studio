import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { get, set } from 'idb-keyval';
import { Sparkles, Download, Settings2, Upload, X, Check, Layers, RotateCcw } from 'lucide-react';
import { initialProject, fonts, dimensions, activeVariant, type Project, type Format } from './model';
import { Button } from './components/base/buttons/button';
import { Input } from './components/base/input/input';
import { TextArea } from './components/base/textarea/textarea';
import { Slider } from './components/base/slider/slider';
import { Tabs } from './components/application/tabs/tabs';
import { Badge } from './components/base/badges/badges';
import { Select } from './components/base/select/select';
import { ModalOverlay, Modal, Dialog, Heading } from 'react-aria-components';
import { ensureFont, fontFamily, fontWeight, googleFonts } from './fonts';
import { renderProject, fileToImage } from './render';

export default function App() {
  const [p, update] = useState<Project>(initialProject);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [settings, showSettings] = useState(false);
  const [url, setUrl] = useState(() => localStorage.getItem('studio-worker') || 'https://appstore-studio-api.dimarandom1337.workers.dev');
  const [token, setToken] = useState('');
  const [search, setSearch] = useState(initialProject.font);
  useEffect(() => { setSearch(p.font); }, [p.font]);
  const [rendering, setRendering] = useState(false);
  const [customFont, setCustomFont] = useState(''), [fontLoading, setFontLoading] = useState('');
  const fontRequest = useRef(0);
  async function selectFont(family: string) { const id = ++fontRequest.current; setFontLoading(family); setError(''); try { await ensureFont(family); if(id === fontRequest.current) patch({font:family}); } catch(e) { if(id === fontRequest.current) setError(e instanceof Error ? e.message : 'Не удалось загрузить шрифт.'); } finally { if(id === fontRequest.current) setFontLoading(''); } }
  const canvas = useRef<HTMLCanvasElement>(null), renderVersion = useRef(0), inFlight = useRef(false);
  const patch = (value: Partial<Project>) => { update(prev => ({ ...prev, ...value })); setError(''); };
  useEffect(() => { get<Project>('store-studio-project').then(value => { if (value && Array.isArray(value.variants)) update({ ...initialProject, ...value }); }).catch(() => setMessage('Локальное сохранение недоступно.')).finally(() => setReady(true)); }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { set('store-studio-project', p).catch(() => setMessage('Не удалось сохранить проект: проверь свободное место в браузере.')); }, 600);
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
      localStorage.setItem('studio-worker', origin); setMessage(`Подключено · ${body.model}`); showSettings(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка подключения.'); }
  }
  async function generate() {
    if (inFlight.current) return;
    if (!token || !url) { showSettings(true); return; }
    inFlight.current = true; setBusy(true); setError(''); setMessage('Генерация обычно занимает 1–3 минуты.');
    const snapshot = p;
    try {
      const r = await fetch(`${endpoint()}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt: snapshot.prompt, style: snapshot.style, format: snapshot.format, position: snapshot.position, mode: snapshot.mode, reference: snapshot.reference, ui: snapshot.ui }), signal: AbortSignal.timeout(300000) });
      const body = await r.json(); if (!r.ok) { if (r.status === 401) showSettings(true); throw new Error(body.error || 'Не удалось сгенерировать изображение.'); }
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
  const uploader = (target: 'reference' | 'ui', title: string, description: string) => <div className="upload-card">
    <label className="upload-label">
      {p[target] ? <img src={p[target]} alt={title}/> : <span className="upload-icon"><Upload size={20}/></span>}
      <strong>{title}</strong><span>{p[target] ? 'Нажми, чтобы заменить изображение' : description}</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={title} onChange={e => { void upload(e.target.files?.[0], target); e.target.value=''; }}/>
    </label>{p[target] && <Button color="tertiary" size="sm" iconLeading={X} aria-label={`Удалить ${title}`} className="upload-remove" onPress={() => patch({[target]:''})}/>}
  </div>;
  const segment = (label: string, value: string, options: {id:string;label:string}[], change:(id:string)=>void) => <Tabs selectedKey={value} onSelectionChange={key=>change(String(key))}><Tabs.List type="button-border" fullWidth aria-label={label} items={options}>{item=><Tabs.Item id={item.id}>{item.label}</Tabs.Item>}</Tabs.List></Tabs>;
  const range = (label: string, value: number, min: number, max: number, change:(v:number)=>void, suffix='') => <div className="slider-field"><div><span>{label}</span><span>{value}{suffix}</span></div><Slider aria-label={label} value={value} minValue={min} maxValue={max} onChange={v=>change(Array.isArray(v)?v[0]:v)}/></div>;
  const select = (label: string, value: string, options: {id:string;label:string}[], change:(id:string)=>void) => <Select label={label} size="sm" selectedKey={value} onSelectionChange={key=>key && change(String(key))} items={options}>{item=><Select.Item id={item.id}>{item.label}</Select.Item>}</Select>;
  const fontOptions = [...new Set([...fonts, ...googleFonts, p.font])].filter(f=>search === p.font || f.toLowerCase().includes(search.trim().toLowerCase())).map(f=>({id:f,label:f}));
  const highlightFont = (name: string) => { const query = search === p.font ? '' : search.trim(); const start = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1; return start < 0 ? name : <>{name.slice(0,start)}<mark className="font-match">{name.slice(start,start+query.length)}</mark>{name.slice(start+query.length)}</>; };
  return <div className="app">
    <header className="studio-header"><a className="brand" href="#"><span className="brand-mark"><Layers size={24}/></span>Store Studio<Badge color="gray" size="sm">Beta</Badge></a><div className="header-actions"><Button size="sm" iconLeading={Download} isDisabled={rendering || !!fontLoading} onPress={download}>Скачать PNG</Button></div></header>
    <div className="workspace"><aside className="controls"><div className="controls-scroll"><div className="panel-heading"><Badge color="brand" size="sm">App Store screenshots</Badge><h1>Создай свой<br/>следующий скриншот.</h1><p>AI-оформление и типографика в одном месте.</p></div>
      <div className="panel-content"><section><h2>Размер скриншота</h2>{segment('Размер скриншота',p.format,[{id:'iphone',label:'iPhone'},{id:'ipad',label:'iPad'}],id=>chooseFormat(id as Format))}<p className="helper">{dimensions[p.format].join(' × ')} px · PNG</p></section>
      <section><h2>Материалы для генерации</h2><div className="materials-grid">{uploader('reference','Референс оформления','Композиция, фон и стиль')}{uploader('ui','UI приложения','PNG, JPEG, WebP · до 15 МБ')}</div><div className="field-gap mode-options"><span className="plain-label">Работа с UI</span>{segment('Работа с UI',p.mode,[{id:'full',label:'AI-композиция'},{id:'preserve',label:'Оригинальный UI'}],id=>patch({mode:id as Project['mode']}))}</div><p className="helper">{p.mode === 'full' ? 'Модель переносит UI в композицию. Мелкие детали могут измениться.' : 'Исходный экран накладывается без перерисовки.'}</p>{p.mode === 'preserve' && range('Размер UI',p.uiScale,35,95,v=>patch({uiScale:v}),'%')}</section>
      <section><h2>{p.reference?'Изменения к референсу':'Визуальное направление'}</h2>{!p.reference && select('Стиль',p.style,['Мягкие 3D-формы','Минимализм','Яркий градиент','Тёмный премиум'].map(s=>({id:s,label:s})),style=>patch({style}))}<TextArea size="sm" label={p.reference?'Что изменить?':'Описание оформления'} rows={3} placeholder={p.reference?'Оставь пустым, чтобы сохранить дизайн максимально близко к образцу.':'Приложение для медитации, мягкий свет, лавандовые оттенки…'} value={p.prompt} maxLength={2000} onChange={prompt=>patch({prompt})}/></section><section id="headline-settings"><h2>Заголовок</h2><TextArea size="sm" label="Заголовок" value={p.title} rows={3} maxLength={250} onChange={title=>patch({title})}/><p className="helper">Оставь пустым для экспорта без заголовка.</p>{range('Размер текста',p.fontSize,32,180,v=>patch({fontSize:v}),' px')}<div className="text-fields"><label className="color-label">Цвет<input aria-label="Цвет заголовка" type="color" value={p.color} onChange={e=>patch({color:e.target.value})}/></label>{select('Выравнивание',p.align,[{id:'left',label:'Слева'},{id:'center',label:'По центру'},{id:'right',label:'Справа'}],id=>patch({align:id as Project['align']}))}</div>{segment('Положение текста',p.position,[{id:'top',label:'Сверху'},{id:'bottom',label:'Снизу'}],id=>patch({position:id as Project['position']}))}{range('Боковые отступы',p.padding,3,18,v=>patch({padding:v}),'%')}{range('Затемнение под текстом',p.shade,0,85,v=>patch({shade:v}),'%')}</section>
      <section><div className="section-heading"><h2>Каталог шрифтов</h2><Badge color="gray" size="sm">Google Fonts</Badge></div><div className="font-preview" style={{fontFamily:`"${fontFamily(p.font)}"`,fontWeight:fontWeight(p.font)}}>{p.title.split('\n')[0] || 'Большие идеи. Aa'}</div><Select.ComboBox size="sm" label="Шрифт" placeholder="Введи название шрифта" shortcut={false} selectedKey={p.font} inputValue={search} onKeyDown={event=>{if(event.key==='Escape') setSearch(p.font);}} onInputChange={setSearch} onSelectionChange={key=>{if(key) void selectFont(String(key));}} items={fontOptions} allowsEmptyCollection>{item=><Select.Item id={item.id} value={item} textValue={item.label}>{highlightFont(item.label || String(item.id))}</Select.Item>}</Select.ComboBox>{!fontOptions.length&&<p className="helper">Нет в подборке? Добавь семейство ниже.</p>}{fontLoading&&<p className="helper" role="status">Загружаем {fontLoading}…</p>}<p className="helper">{fonts.length + googleFonts.length} семейства в подборке. Google Fonts загружаются при выборе. Поддержка кириллицы зависит от шрифта.</p><Input size="sm" label="Добавить другой Google Font" placeholder="Например, Sora" value={customFont} onChange={setCustomFont}/><Button color="secondary" size="sm" className="full-width" isDisabled={!customFont.trim()} isLoading={!!fontLoading && fontLoading===customFont.trim()} onPress={()=>selectFont(customFont.trim())}>Загрузить шрифт</Button></section></div>
      </div><div className="generate-area"><Button size="md" className="full-width" iconLeading={Sparkles} isLoading={busy} isDisabled={busy} onPress={generate}>{busy?'Создаём оформление…':'Сгенерировать скриншот'}</Button></div>
    </aside><main className="canvas-main"><div className="canvas-toolbar"><div><span className="eyebrow">ПРЕДПРОСМОТР</span><h2>{p.format==='iphone'?'iPhone':'iPad'} screenshot</h2></div><Badge color="gray" size="md">{dimensions[p.format].join(' × ')} px</Badge></div>
      {(error || message) && <div className={`notice ${error?'error':''}`} role={error?'alert':'status'}><span>{error || message}</span><Button color="tertiary" size="sm" iconLeading={X} aria-label="Скрыть уведомление" onPress={()=>{setError('');setMessage('');}}/></div>}
      <div className={`stage ${p.format}`}><div className="canvas-frame" style={{aspectRatio:dimensions[p.format][0]/dimensions[p.format][1], '--canvas-ratio':dimensions[p.format][0]/dimensions[p.format][1]} as CSSProperties}><canvas ref={canvas} aria-label="Предпросмотр скриншота"/>{busy&&<div className="generating-overlay"><Sparkles size={30} className="spin"/><strong>Создаём оформление</strong><span>Текст можно редактировать во время генерации</span></div>}</div></div><div className="preview-note"><Badge color="gray" size="sm">{variant?'Готово к экспорту':'Демо-оформление'}</Badge><span>PNG</span></div>
    </main><aside className="history"><div className="section-heading"><h2>Варианты</h2><Badge color="gray" size="sm">{p.variants.length}</Badge></div><p className="helper">Выбери лучшее оформление.</p><div className="variant-list">{p.variants.filter(v=>v.format===p.format).map((v,i)=><button key={v.id} className={`variant ${v.id===p.activeId?'selected':''}`} aria-pressed={v.id===p.activeId} onClick={()=>patch({activeId:v.id})}><img src={v.image} alt={`Вариант ${i+1}`}/><span>{i===0?'Последний':'Вариант '+(i+1)}<small>{new Date(v.created).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</small></span>{v.id===p.activeId&&<i><Check size={14}/></i>}</button>)}{!p.variants.some(v=>v.format===p.format)&&<div className="empty-history"><Layers size={30}/><strong>Пока нет вариантов</strong><p>Сгенерируй оформление или загрузи готовый фон.</p></div>}</div><label className="import-background"><Upload size={16}/>Загрузить готовый фон<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Загрузить готовый фон" onChange={e=>{void upload(e.target.files?.[0],'background');e.target.value='';}}/></label><Button color="tertiary" size="sm" iconLeading={RotateCcw} className="full-width" onPress={()=>patch({activeId:''})}>Показать демо</Button><div className="local-note"><strong>Хранится на этом устройстве</strong><p>Проект и последние 12 вариантов сохраняются в браузере.</p></div></aside></div>
    <ModalOverlay isOpen={settings} onOpenChange={showSettings} isDismissable className="modal-backdrop"><Modal className="modal"><Dialog className="dialog"><Button color="tertiary" size="sm" className="modal-close" iconLeading={X} aria-label="Закрыть настройки" onPress={()=>showSettings(false)}/><span className="upload-icon"><Settings2 size={24}/></span><Heading slot="title">Подключить генерацию</Heading><p>OpenRouter работает через Cloudflare Worker. API-ключ остаётся в Cloudflare.</p><Input size="md" label="Адрес Worker" placeholder="https://имя.workers.dev" value={url} onChange={value=>{setUrl(value);}}/><Input size="md" label="Код доступа" type="password" autoComplete="off" placeholder="STUDIO_ACCESS_TOKEN" value={token} onChange={value=>{setToken(value);}}/><p className="helper">Код хранится в памяти страницы. После перезагрузки введи его снова.</p>{error&&<div className="notice error" role="alert">{error}</div>}<Button className="full-width" onPress={checkConnection}>Проверить и подключить</Button></Dialog></Modal></ModalOverlay>
  </div>;
}
