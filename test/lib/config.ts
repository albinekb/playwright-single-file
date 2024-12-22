import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import playwrightConfig from '../../playwright.config.js'
import assert from 'assert'

export function getOutputDir() {
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  const rootDir = path.join(__dirname, '../../')
  assert(playwrightConfig.outputDir, 'outputDir is required')
  const resultsDir = path.join(rootDir, playwrightConfig.outputDir)
  return path.join(resultsDir, '/output')
}

export async function saveFile(filename: string, content: string) {
  if (!filename) {
    throw new Error('Filename is required')
  }
  if (path.isAbsolute(filename)) {
    throw new Error('Filename must be a relative path')
  }
  const outputPath = path.join(getOutputDir(), filename)
  await fs.writeFile(outputPath, content)
  return outputPath
}
