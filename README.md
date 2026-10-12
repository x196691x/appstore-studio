# Store Studio

React + TypeScript screenshot editor. Static frontend on GitHub Pages, protected image-generation API on Cloudflare Workers, OpenRouter Image API. No managed server.

## Local editor

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The editor and PNG export work before AI is connected. Generated images and the latest 12 variants are stored locally in IndexedDB. Seven base fonts ship with the site, including Cyrillic. The font picker adds 36 Google Fonts families loaded on demand via CSS2 and supports additional families by name (700 with a 400 fallback). Export waits for the selected font to load. iPhone: 1242×2688; iPad: 2048×2732.

## Connect your existing Cloudflare Worker

Set `name` in `wrangler.jsonc` to your existing Worker name. This deploy replaces that Worker's code, so choose a dedicated Worker for this app. `ALLOWED_ORIGINS` contains the frontend origin, without a path. It already allows the owner's GitHub Pages origin and local Vite.

```sh
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put STUDIO_ACCESS_TOKEN
npm run worker:deploy
```

OpenRouter's key is entered in the first interactive prompt; use a long random access code for the second. Do not commit either value. For local Worker development put them in the ignored `.dev.vars` file.

After deploy, click **Подключить AI** in the editor and enter the Worker URL plus access code. The code remains only in page memory; the URL is saved. A health check validates the code and Worker setup without a paid generation. Models are fixed server-side (`IMAGE_MODEL`, default `openai/gpt-image-2`). Current API contract: https://openrouter.ai/docs/guides/overview/multimodal/image-generation.

A SQLite Durable Object serializes generations and limits attempts globally to 10/day (UTC), including failed attempts. Both limits are enforced server-side; CORS is not treated as authentication. Configure `DAILY_LIMIT` to change the cap; additionally cap spending on the OpenRouter key. Auth protects this personal MVP; public paid accounts require per-user authentication and quotas.

## Deploy frontend

The included `.github/workflows/pages.yml` builds/tests and deploys on pushes to main. In repository settings select Pages → GitHub Actions. Vite uses relative asset URLs for repository subpaths. Worker deployment is separate; no API secret belongs in the frontend or GitHub Pages.

## Behavior

- Full AI composition uses design reference and UI as inputs. It can change small UI details.
- Preserve UI mode generates background art and composites the original screen separately.
- Header text, typeface, color, alignment, position and shade are composed by Canvas, after generation.
- Export dimensions are exact; generated backgrounds are center-cropped proportionally. It does not stretch the image.
- Each format has its own variants. Changing format does not stretch the other format's AI background.
- UI and references are decoded and reduced to at most 2048 pixels on the longest side, exported to PNG before upload.
- Changing headline position does not reposition generated art; regenerate if the reserved region needs to move.

## Verification

```sh
npm test
npm run build
```

Live AI requires Cloudflare login, deployed Worker and configured secrets; local tests use no paid generation.

## UI and reference matching

The editor uses the official MIT-licensed Untitled UI React components (Button, Input, TextArea, Select, Slider, Tabs, Badge) and its Tailwind theme. License is preserved in src/components/UNTITLED-UI-LICENSE. Connection dialog uses React Aria Modal/Dialog.

When a design reference is uploaded it takes precedence over style presets. The model is instructed to preserve composition, colors, lighting, shapes and device placement, remove promotional text, and replace the app screen with supplied UI. Leave the changes field blank for closest matching. Text inside app UI is preserved. AI cannot guarantee a pixel-identical result. Existing variants are not regenerated.
