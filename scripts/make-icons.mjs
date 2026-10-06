// Gera as imagens-fonte do ícone e do ecrã de arranque (pasta assets/) a partir do desenho em SVG.
// Depois: npx capacitor-assets generate --android
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>`

/** Moeda com o símbolo do euro (desenhada numa grelha de 512). */
const coin = `
  <circle cx="256" cy="256" r="152" fill="none" stroke="#ffffff" stroke-width="26"/>
  <path d="M304 194c-13-14-32-22-53-22-42 0-71 35-71 84s29 84 71 84c21 0 40-8 53-22" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>
  <path d="M158 236h112M158 278h112" stroke="#ffffff" stroke-width="24" stroke-linecap="round"/>`

const svg = (body, size = 512) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${body}</svg>`)

// Ícone completo (ícones antigos/redondos).
const iconOnly = svg(`${gradient}<rect width="512" height="512" fill="url(#g)"/>${coin}`)
// Ícone adaptativo: primeiro plano dentro da zona segura (~61% do diâmetro) + fundo.
const foreground = svg(`<g transform="translate(256 256) scale(0.8) translate(-256 -256)">${coin}</g>`)
const background = svg(`${gradient}<rect width="512" height="512" fill="url(#g)"/>`)
// Ecrã de arranque: ícone ao centro, fundo claro / escuro como a app.
const splash = (bg) =>
  svg(`<rect width="2732" height="2732" fill="${bg}"/>${gradient}
    <g transform="translate(1110 1110)"><rect width="512" height="512" rx="112" fill="url(#g)"/>${coin}</g>`, 2732)

mkdirSync('assets', { recursive: true })
await sharp(iconOnly).resize(1024, 1024).png().toFile('assets/icon-only.png')
await sharp(foreground).resize(1024, 1024).png().toFile('assets/icon-foreground.png')
await sharp(background).resize(1024, 1024).png().toFile('assets/icon-background.png')
await sharp(splash('#f3f4f6')).png().toFile('assets/splash.png')
await sharp(splash('#0b1120')).png().toFile('assets/splash-dark.png')
console.log('Imagens criadas em assets/')
