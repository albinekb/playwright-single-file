import { expect, test, errors } from '@playwright/test'
import { pageToSingleFile } from '../src/index.js'
import { saveFile } from './lib/config.js'
import { compareScreenshots, diffScreenshots } from './lib/screenshots.js'

test.describe('SingleFile scripts', () => {
  test('should save page as HTML with removeScripts false', async ({
    page,
  }, testInfo) => {
    // Navigate to a test page
    await page.goto('https://qa.tech')

    const withScripts = await pageToSingleFile(page, {
      removeScripts: false,
      blockScripts: false,
    })

    const withScriptsPath = await saveFile(
      'qa.tech_withScripts.html',
      withScripts.content,
    )

    expect(withScripts.content).toContain('<script')
    expect(withScripts.content).toContain('</script>')
    expect(withScripts.content).toContain('application/javascript')
    expect(withScripts.stats!.discarded.scripts).toEqual(0)
    expect(withScripts.stats!.processed.scripts).toBeGreaterThan(0)

    const withoutScripts = await pageToSingleFile(page, {
      removeScripts: true,
      blockScripts: true,
      removeEmptyLines: true,
    })
    const withoutScriptsPath = await saveFile(
      'qa.tech_withoutScripts.html',
      withoutScripts.content,
    )

    expect(withoutScripts.stats!.discarded.scripts).toEqual(
      withoutScripts.stats!.processed.scripts,
    )

    console.log('withoutScripts.stats', withoutScripts.stats)
    console.log('withScripts.stats', withScripts.stats)

    const scriptTagsCount = withoutScripts.content.match(/<script/g)?.length
    expect(scriptTagsCount).toEqual(1)
    const scriptTagsCloseCount =
      withoutScripts.content.match(/<\/script>/g)?.length
    expect(scriptTagsCloseCount).toEqual(1)
    expect(withoutScripts.content).not.toContain('application/javascript')

    // expect(withoutScripts).not.toContain('\n\n\n')

    // Check that they render the same
    await page.goto(`file://${withScriptsPath}`)
    const withScriptsPageScreenshot = await page.screenshot({
      animations: 'disabled',
      type: 'png',
    })

    await page.goto(`file://${withoutScriptsPath}`)
    const withoutScriptsPageScreenshot = await page.screenshot({
      animations: 'disabled',
      type: 'png',
    })

    await compareScreenshots(
      withScriptsPageScreenshot,
      withoutScriptsPageScreenshot,
    )

    const { diff } = await diffScreenshots(
      withScriptsPageScreenshot,
      withoutScriptsPageScreenshot,
      {
        threshold: 0.01,
      },
    )

    testInfo.annotations.push({
      type: 'diff',
      description: `${diff}`,
    })

    expect(diff, 'Diff should be 0').toEqual(0)
  })
})
