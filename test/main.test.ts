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
    const html = await pageToSingleFile(page, {
      removeScripts: true,
      compressHTML: false,
      removeHidden: false,
    })

    const savedFilePath = await saveFile(filename, html)

    // Verify the output
    expect(html).toBeTruthy()
    expect(html).toContain('<html')
    expect(html).toContain('</html>')

    // Verify the file was saved
    await expect(fs.access(savedFilePath)).resolves.not.toThrow()
  })
})
