import { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: './test',
  timeout: 30000,
  outputDir: './test/.results',
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  globalSetup: './test/lib/setup.ts',
}

export default config
