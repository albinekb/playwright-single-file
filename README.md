# Playwright SingleFile

A Node.js library that integrates [SingleFile](https://github.com/gildas-lormeau/SingleFile) functionality with Playwright for saving complete web pages as single HTML files. This package allows you to capture full-page snapshots including CSS, images, and other resources embedded directly in the HTML file.

## Installation

```bashc
pnpm add playwright-single-file
```

## Requirements

- Node.js 16 or higher
- Playwright ^1.48.0 (peer dependency)

## Usage

```typescript
import { chromium } from 'playwright'
import { pageToSingleFile } from 'playwright-single-file'

// Basic usage
async function savePage(page) {
  const pageData = await pageToSingleFile(page, {
    removeScripts: true,
    compressHTML: false,
    removeHidden: false,
  })

  // pageData.content contains the HTML string
  // pageData.stats contains processing statistics
  await fs.writeFile('output.html', pageData.content)
}

// Advanced usage with script handling
async function savePageWithScripts(page) {
  const pageData = await pageToSingleFile(page, {
    removeScripts: false, // Keep JavaScript
    blockScripts: false, // Don't block script execution
  })

  // Stats will show processed vs discarded resources
  console.log('Stats:', pageData.stats)
  // {
  //   processed: { scripts: number, ... },
  //   discarded: { scripts: number, ... }
  // }
}
```

### Options

- `removeScripts`: Remove JavaScript from the page (default: false)
- `blockScripts`: Block script execution (default: false)
- `compressHTML`: Compress the output HTML (default: false)
- `removeHidden`: Remove hidden elements (default: false)
- `removeEmptyLines`: Remove empty lines from output (default: false)

## Features

- Captures complete web pages as single HTML files
- Embeds CSS, images, and other resources
- Configurable script handling (remove/keep/block)
- Detailed processing statistics
- Compatible with Playwright's automation capabilities
- TypeScript support

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests in debug mode
pnpm test:debug
```

## Made possible by

- [SingleFile](https://github.com/gildas-lormeau/SingleFile)
- [SingleFile CLI](https://github.com/gildas-lormeau/single-file-cli)
- [single-file-core](https://github.com/gildas-lormeau/single-file-core)

## License

SingleFile and SingleFile CLI are licensed under AGPL. Code derived from third-party projects is licensed under MIT. Contact gildas.lormeau &lt;at&gt; gmail.com if you are interested in licensing the SingleFile code for a commercial service or product.
