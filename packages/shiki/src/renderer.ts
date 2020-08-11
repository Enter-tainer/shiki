import { IThemedToken } from './themedTokenizer'
const escape = require('lodash/escape.js')
export interface HtmlRendererOptions {
  langId?: string
  bg?: string
}

const escapeHtml = escape

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

  lines.forEach((l: any[]) => {
    if (l.length === 0) {
      html += `\n`
    } else {
      l.forEach(token => {
        html += `<span style="color: ${token.color}">${escapeHtml(token.content)}</span>`
        // html += `<span class=${css.getClassName(token.color)}>${escapeHtml(token.content)}</span>`
      })
      html += `\n`
    }
  })
  html = html.replace(/\n*$/, '') // Get rid of final new lines
  html += `</code></pre>`

  return html
}
