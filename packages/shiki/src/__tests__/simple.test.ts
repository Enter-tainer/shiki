import { getHighlighter } from '../index'

test('Nord highlighter highlights simple JavaScript', async () => {
  const highlighter = await getHighlighter({
    theme: 'nord'
  })
  const out = highlighter.codeToHtml(`console.log('shiki');`, 'js', false)
  expect(out).toMatchSnapshot()
})
