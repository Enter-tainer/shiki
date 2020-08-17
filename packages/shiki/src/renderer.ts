import { IThemedToken } from './themedTokenizer'
export interface HtmlRendererOptions {
  langId?: string
  bg?: string
}

// class CSSClassGen {
//   private colorMap: Map<string, string> = new Map()
//   public prefix: string = 'shiki-data'
//   constructor(tokenColors: string[], prefix?: string) {
//     if (prefix) {
//       this.prefix = prefix
//     }
//     for (let i = 0; i < tokenColors.length; ++i) {
//       this.colorMap.set(tokenColors[i], `${this.prefix}-${i}`)
//     }
//   }
//   private getSingleCss(color: string, className: string): string {
//     return `.${className}{color: ${color};}\n`
//   }
//   getCss(): string {
//     const keys = Array.from(this.colorMap.entries())
//     let res = ''
//     for (const i of keys) {
//       res += this.getSingleCss(i[0], i[1])
//     }
//     return res
//   }
//   getClassName(color: string): string {
//     return this.colorMap.get(color)
//   }
// }

export function renderToHtml(lines: IThemedToken[][], options: HtmlRendererOptions = {}) {
  const bg = options.bg || '#fff'
  const colors: Set<string> = new Set()
  lines.map(l => {
    l.map(t => {
      colors.add(t.color)
    })
  })
  // const css = new CSSClassGen(Array.from(colors))
  // let html = `<style>${css.getCss()}</style>`
  let html = ''
  html += `<pre class="shiki" style="background-color: ${bg}">`
  if (options.langId) {
    html += `<div class="language-id">${options.langId}</div>`
  }
  html += `<code>`

  const boldCss = bold => (bold ? 'font-weight: bold' : '')
  const italicCss = italic => (italic ? 'font-style: italic' : '')
  const underlineCss = u => (u ? 'text-decoration: underline' : '')
  const colorCss = c => `color: ${c}`
  const Css = (b, i, u, c) =>
    [boldCss(b), italicCss(i), underlineCss(u), colorCss(c)].filter(v => v).join(';')
  lines.forEach(l => {
    if (l.length === 0) {
      html += `\n`
    } else {
      l.forEach(token => {
        html += `<span style="${Css(
          token.fontStyle === 'bold',
          token.fontStyle === 'italic',
          token.fontStyle === 'underline',
          token.color
        )}">${escapeHtml(token.content)}</span>`
        // html += `<span class=${css.getClassName(token.color)}>${escapeHtml(token.content)}</span>`
      })
      html += `\n`
    }
  })
  html = html.replace(/\n*$/, '') // Get rid of final new lines
  html += `</code></pre>`

  return html
}

const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

function escapeHtml(html: string) {
  return html.replace(/[&<>"']/g, chr => htmlEscapes[chr])
}
