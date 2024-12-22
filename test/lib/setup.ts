import fs from 'node:fs/promises'
import { getOutputDir } from './config.js'
export default async function globalSetup() {
  const outputDir = getOutputDir()

  if (
    await fs
      .access(outputDir)
      .then(() => true)
      .catch(() => false)
  ) {
    await fs.rm(outputDir, {
      recursive: true,
      force: true,
    })
  }
  await fs.mkdir(outputDir, { recursive: true })
}
