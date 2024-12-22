import { expect, test } from '@playwright/test'
import * as fs from 'node:fs/promises'
import { pageToSingleFile } from '../src/index.js'
import { getOutputDir, saveFile } from './lib/config.js'

test.describe('SingleFile Plugin', () => {
  const outputDir = getOutputDir()

  test('should save page as HTML', async ({ page }) => {
    // Navigate to a test page
    await page.goto('https://qa.tech')
    // Create a temporary output directory for the test

    const filename = 'qa.tech.html'

    // Save the page
    const pageData = await pageToSingleFile(page, {
      removeScripts: true,
      compressHTML: false,
      removeHidden: false,
    })

    console.log('stats', pageData.stats)

    const savedFilePath = await saveFile(filename, pageData.content)

    // Verify the output
    expect(pageData.content).toBeTruthy()
    expect(pageData.content).toContain('<html')
    expect(pageData.content).toContain('</html>')

    // Verify the file was saved
    await expect(fs.access(savedFilePath)).resolves.not.toThrow()
  })
})
