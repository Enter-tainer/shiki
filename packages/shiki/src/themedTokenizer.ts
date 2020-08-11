/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict'

import { IGrammar, StackElement, IRawTheme, IRawThemeSetting, IToken } from 'vscode-textmate'
import { StackElementMetadata } from './stackElementMetadata'
import { writeFile } from 'fs'
import { promisify } from 'util'
import path = require('path')
import os = require('os')
import crypto = require('crypto')
import { TLang } from 'shiki-languages'
import { getTokens } from '@mgtd/semantic-token-provider'
import { kMaxLength } from 'buffer'

function sha256(data: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

const writeFileP = promisify(writeFile)

export interface IThemedTokenScopeExplanation {
  scopeName: string
  themeMatches: IRawThemeSetting[]
}

export interface IThemedTokenExplanation {
  content: string
  scopes: IThemedTokenScopeExplanation[]
}

export interface IThemedToken {
  content: string
  color?: string
  explanation?: IThemedTokenExplanation[]
}

// A rule for how to color TextMate scopes.
interface TokenColorRule {
  // A TextMate scope that specifies the context of the token, e.g.
  // "entity.name.function.cpp".
  scope?: string | string[]
  // foreground is the color tokens of this scope should have.
  settings: {
    foreground?: string
  }
}

export class ThemeRuleMatcher {
  // The rules for the theme.
  private themeRules: TokenColorRule[]
  // A cache for the getBestThemeRule function.
  private bestRuleCache: Map<string, TokenColorRule> = new Map()
  constructor(rules: TokenColorRule[]) {
    this.themeRules = rules
  }
  // Returns the best rule for a scope.
  getBestThemeRule(scope: string): TokenColorRule {
    if (this.bestRuleCache.has(scope)) return this.bestRuleCache.get(scope)
    let bestRule: TokenColorRule = { scope: '', settings: { foreground: '' } }
    this.themeRules.forEach(rule => {
      // The best rule for a scope is the rule that is the longest prefix of the
      // scope (unless a perfect match exists in which case the perfect match is
      // the best). If a rule is not a prefix and we tried to match with longest
      // common prefix instead variables would be highlighted as `less`
      // variables when using Light+ (as variable.other would be matched against
      // variable.other.less in this case). Doing common prefix matching also
      // means we could match variable.cpp to variable.css if variable.css
      // occurs before variable in themeRules.
      // FIXME: This is not defined in the TextMate standard (it is explicitly
      // undefined, https://macromates.com/manual/en/scope_selectors). Might
      // want to rank some other way.
      if (typeof rule.scope === 'string') {
        if (scope.startsWith(rule.scope) && rule.scope.length > bestRule.scope.length)
          // This rule matches and is more specific than the old rule.
          bestRule = rule
      } else {
        rule.scope.map(v => {
          if (scope.startsWith(v) && rule.scope.length > bestRule.scope.length) bestRule = rule
        })
      }
    })
    this.bestRuleCache.set(scope, bestRule)
    return bestRule
  }
}

type StringLiteralUnion<T extends U, U = string> = T | (U & {})

function mapTokens(tokens): IToken[][] {
  const lines = tokens[tokens.length - 1].line
  const res = []
  for (let i = 0, j = 0; i <= lines; ++i) {
    if (tokens[j].line === i) {
      res.push(tokens[j].tokens)
      ++j
    } else {
      res.push([])
    }
  }
  return res
}

export async function tokenizeWithTheme(
  theme: IRawTheme,
  colorMap: string[],
  fileContents: string,
  grammar: IGrammar,
  lang: StringLiteralUnion<TLang>,
  semantic: boolean
): Promise<IThemedToken[][]> {
  let lines = fileContents.split(/\r\n|\r|\n/)
  let ruleStack: StackElement = null
  let actual: IThemedToken[] = []
  let final: IThemedToken[][] = []
  const name = `${sha256(fileContents).slice(0, 8)}.${lang}`
  const filepath = path.join(os.tmpdir(), name)
  await writeFileP(filepath, fileContents)
  let semanticTokens
  if (semantic) {
    semanticTokens = mapTokens(await getTokens(['-log=verbose'], filepath))
  }
  const themeMatcher = new ThemeRuleMatcher(theme.settings)
  // console.log(semanticTokens)
  // semanticTokens.map(v => {
  //   v.map(c => {
  //     console.log(themeMatcher.getBestThemeRule(c.scopes[0]))
  //   })
  // })
  for (let i = 0, len = lines.length; i < len; i++) {
    let line = lines[i]
    if (line === '') {
      actual = []
      final.push([])
      continue
    }

    let resultWithScopes = grammar.tokenizeLine(line, ruleStack)
    let tokensWithScopes = resultWithScopes.tokens

    let result = grammar.tokenizeLine2(line, ruleStack)

    let tokensLength = result.tokens.length / 2
    let tokensWithScopesIndex = 0
    for (let j = 0; j < tokensLength; j++) {
      let startIndex = result.tokens[2 * j]
      let nextStartIndex = j + 1 < tokensLength ? result.tokens[2 * j + 2] : line.length
      let tokenText = line.substring(startIndex, nextStartIndex)
      if (tokenText === '') {
        continue
      }
      let metadata = result.tokens[2 * j + 1]
      let foreground = StackElementMetadata.getForeground(metadata)
      let foregroundColor = colorMap[foreground]

      let explanation: IThemedTokenExplanation[] = []
      let tmpTokenText = tokenText
      while (tmpTokenText.length > 0) {
        let tokenWithScopes = tokensWithScopes[tokensWithScopesIndex]

        let tokenWithScopesText = line.substring(
          tokenWithScopes.startIndex,
          tokenWithScopes.endIndex
        )
        tmpTokenText = tmpTokenText.substring(tokenWithScopesText.length)
        explanation.push({
          content: tokenWithScopesText,
          scopes: explainThemeScopes(theme, tokenWithScopes.scopes)
        })

        tokensWithScopesIndex++
      }
      actual.push({
        content: tokenText,
        color: foregroundColor
        // explanation: explanation
      })
    }
    if (semantic) {
      const semanticLine = semanticTokens[i]
      const splitFirst = (str: string, sp: string): [string, string] => {
        const [res, ...remain] = str.split(sp)
        // console.log(str, sp, res, remain)
        return [res, remain.join(sp)]
      }
      const getToken = (start: number, end: number): string => {
        return line.slice(start, end)
      }
      const cond = (c, v) => (c ? [v] : [])
      if (semanticLine && semanticLine.length !== 0) {
        let charCnt = 0,
          semanticTokenI = 0
        for (let j = 0; j < actual.length && semanticTokenI < semanticLine.length; ++j) {
          const curToken = semanticLine[semanticTokenI]
          const curTokenStr = getToken(curToken.startIndex, curToken.endIndex)
          // console.log(curToken, curTokenStr)
          if (
            curToken.startIndex < charCnt + actual[j].content.length &&
            charCnt + actual[j].content.length <= charCnt + actual[j].content.length
          ) {
            // console.log(actual[j])
            const [l, r] = splitFirst(actual[j].content, curTokenStr)
            actual.splice(
              j,
              1,
              ...cond(l !== '', { content: l, color: actual[j].color }),
              {
                content: curTokenStr,
                color: themeMatcher.getBestThemeRule(curToken.scopes[0]).settings.foreground
              },
              ...cond(r !== '', { content: r, color: actual[j].color })
            )
            // console.log(actual.slice(j, j + 3))
            ++semanticTokenI
            if (l.length !== 0) {
              charCnt += l.length
            } else {
              charCnt += curTokenStr.length
            }
          } else {
            charCnt += actual[j].content.length
          }
        }
        // for (let j = 0; j < semanticLine.length; ++j) {
        //   const semanticTokenName = line.slice(semanticLine[j].startIndex, semanticLine[j].endIndex)
        //   for (let k = 0; k < actual.length; ++k) {
        //     if (semanticTokenName === actual[k].content) {
        //       const match = themeMatcher.getBestThemeRule(semanticLine[j].scopes[0])
        //       actual[k].color = match.settings.foreground
        //       // actual[k].explanation[0].scopes = [{ scopeName: semanticLine[j].scopes[0], themeMatches: [match]}]
        //       // console.log(actual[k].content, actual[k].color, actual[k].explanation[0].scopes)
        //     }
        //   }
        // }
      }
    }

    final.push(actual)
    actual = []
    ruleStack = result.ruleStack
  }
  return final
}

function explainThemeScopes(theme: IRawTheme, scopes: string[]): IThemedTokenScopeExplanation[] {
  let result: IThemedTokenScopeExplanation[] = []
  for (let i = 0, len = scopes.length; i < len; i++) {
    let parentScopes = scopes.slice(0, i)
    let scope = scopes[i]
    result[i] = {
      scopeName: scope,
      themeMatches: explainThemeScope(theme, scope, parentScopes)
    }
  }
  return result
}

function matchesOne(selector: string, scope: string): boolean {
  let selectorPrefix = selector + '.'
  if (selector === scope || scope.substring(0, selectorPrefix.length) === selectorPrefix) {
    return true
  }
  return false
}

function matches(
  selector: string,
  selectorParentScopes: string[],
  scope: string,
  parentScopes: string[]
): boolean {
  if (!matchesOne(selector, scope)) {
    return false
  }

  let selectorParentIndex = selectorParentScopes.length - 1
  let parentIndex = parentScopes.length - 1
  while (selectorParentIndex >= 0 && parentIndex >= 0) {
    if (matchesOne(selectorParentScopes[selectorParentIndex], parentScopes[parentIndex])) {
      selectorParentIndex--
    }
    parentIndex--
  }

  if (selectorParentIndex === -1) {
    return true
  }
  return false
}

function explainThemeScope(
  theme: IRawTheme,
  scope: string,
  parentScopes: string[]
): IRawThemeSetting[] {
  let result: IRawThemeSetting[] = [],
    resultLen = 0
  for (let i = 0, len = theme.settings.length; i < len; i++) {
    let setting = theme.settings[i]
    let selectors: string[]
    if (typeof setting.scope === 'string') {
      selectors = setting.scope.split(/,/).map(scope => scope.trim())
    } else if (Array.isArray(setting.scope)) {
      selectors = setting.scope
    } else {
      continue
    }
    for (let j = 0, lenJ = selectors.length; j < lenJ; j++) {
      let rawSelector = selectors[j]
      let rawSelectorPieces = rawSelector.split(/ /)

      let selector = rawSelectorPieces[rawSelectorPieces.length - 1]
      let selectorParentScopes = rawSelectorPieces.slice(0, rawSelectorPieces.length - 1)

      if (matches(selector, selectorParentScopes, scope, parentScopes)) {
        // match!
        result[resultLen++] = setting
        // break the loop
        j = lenJ
      }
    }
  }
  return result
}
