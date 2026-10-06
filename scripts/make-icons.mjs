// Gera as imagens-fonte do ícone e do ecrã de arranque (pasta assets/) a partir do logótipo Freela.
// O desenho é o mesmo de public/icon.svg. Depois: npx capacitor-assets generate --android (ver "npm run android:icons").
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

// --- Logótipo: "F" em duas asas (grelha de 512) ---
const STEM_AND_TOP =
  'M120 430 C122 342 130 268 152 212 C186 118 300 80 440 70 C406 136 340 178 270 194 C232 203 208 222 202 258 C196 312 192 364 190 408 Z'
const MIDDLE = 'M186 344 C186 300 194 274 214 258 C256 228 316 210 390 202 C358 252 308 290 246 306 C218 314 198 324 186 344 Z'
const FOLD = 'M186 344 C186 300 194 274 214 258 C226 250 238 244 252 238 C236 258 232 282 244 306 C218 314 198 324 186 344 Z'

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d2a72"/><stop offset="1" stop-color="#081c52"/></linearGradient>
  <linearGradient id="top" x1="0.15" y1="1" x2="0.9" y2="0"><stop offset="0" stop-color="#1c5ce2"/><stop offset="0.55" stop-color="#2f85f6"/><stop offset="1" stop-color="#58b3ff"/></linearGradient>
  <linearGradient id="mid" x1="0" y1="1" x2="1" y2="0.1"><stop offset="0" stop-color="#1d58d8"/><stop offset="1" stop-color="#429bfc"/></linearGradient>
  <linearGradient id="fold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a2a7a" stop-opacity="0.55"/><stop offset="1" stop-color="#0a2a7a" stop-opacity="0"/></linearGradient>
</defs>`

const letter = `<path d="${STEM_AND_TOP}" fill="url(#top)"/><path d="${MIDDLE}" fill="url(#mid)"/><path d="${FOLD}" fill="url(#fold)"/>`
// O "F" ocupa x 120–440, y 70–430: centrar e reduzir para caber na zona segura dos ícones adaptativos.
const centered = (scale) => `<g transform="translate(256 256) scale(${scale}) translate(-280 -250)">${letter}</g>`

const svg = (body, size = 512) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${defs}${body}</svg>`)

// Ícone completo (o Android aplica a máscara: quadrado/círculo).
const iconOnly = svg(`<rect width="512" height="512" fill="url(#bg)"/>${centered(0.86)}`)
// Ícone adaptativo: primeiro plano (só o "F") + fundo azul-marinho.
const foreground = svg(centered(0.86))
const background = svg(`<rect width="512" height="512" fill="url(#bg)"/>`)
// Ecrã de arranque: logótipo ao centro, fundo claro / escuro como a app.
const splash = (bg) =>
  svg(`<rect width="2732" height="2732" fill="${bg}"/>
    <g transform="translate(1110 1110)"><rect width="512" height="512" rx="96" fill="url(#bg)"/>${letter}</g>`, 2732)

mkdirSync('assets', { recursive: true })
await sharp(iconOnly).resize(1024, 1024).png().toFile('assets/icon-only.png')
await sharp(foreground).resize(1024, 1024).png().toFile('assets/icon-foreground.png')
await sharp(background).resize(1024, 1024).png().toFile('assets/icon-background.png')
await sharp(splash('#f3f4f6')).png().toFile('assets/splash.png')
await sharp(splash('#0b1120')).png().toFile('assets/splash-dark.png')

// Ícone pequeno das notificações (vetor, branco — o Android pinta-o).
const vector = (d) => `    <path android:fillColor="#FFFFFFFF" android:pathData="${d}" />`
writeFileSync(
  'android/app/src/main/res/drawable/ic_stat_freela.xml',
  `<?xml version="1.0" encoding="utf-8"?>
<!-- Ícone pequeno das notificações (o "F" do Freela, branco). Gerado por scripts/make-icons.mjs -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="512"
    android:viewportHeight="512">
  <group android:translateX="-24" android:translateY="6">
${vector(STEM_AND_TOP)}
${vector(MIDDLE)}
  </group>
</vector>
`,
)
console.log('Imagens criadas em assets/ e ícone das notificações atualizado')
