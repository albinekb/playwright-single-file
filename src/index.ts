import { Page } from 'playwright-core'
import { getPageData } from './lib/cdp-client.js'
import { removeEmptyLines, removeScripts } from './lib/remover.js'

interface SavePageAsHtmlOptions extends SavePageOptions {}

// Implementation of the SingleFile plugin
class SingleFile {
  async run(page: Page, options: SavePageAsHtmlOptions = {}): Promise<string> {
    const cdpOptions = createCdpOptions(options)
    const pageData = await getPageData(page, cdpOptions)
    let content =
      typeof pageData.content === 'string'
        ? pageData.content
        : new TextDecoder().decode(new Uint8Array(pageData.content))

    if (cdpOptions.removeScripts) {
      content = removeScripts(content)
    }

    if (cdpOptions.removeEmptyLines) {
      content = removeEmptyLines(content)
    }

    return content
  }
}

export async function pageToSingleFile(
  page: Page,
  options: SavePageAsHtmlOptions = {},
): Promise<string> {
  const singleFile = new SingleFile()
  return singleFile.run(page, options)
}

// Define options for saving pages
export interface SavePageOptions {
  /** Remove frames from the page (default: true) */
  removeFrames?: boolean
  /** Remove scripts from the page (default: true) */
  removeScripts?: boolean
  /** Remove hidden elements from the page (default: true) */
  removeHidden?: boolean
  /** Remove unused styles from the page (default: true) */
  removeUnusedStyles?: boolean
  /** Remove unused fonts from the page (default: true) */
  removeUnusedFonts?: boolean
  /** Remove empty lines from the page (default: false) */
  removeEmptyLines?: boolean
  /** Compress HTML content (default: false) */
  compressHTML?: boolean
  /** Include BOM in the output file (default: false) */
  includeBOM?: boolean
  /** Remove alternative fonts (default: true) */
  removeAlternativeFonts?: boolean
  /** Remove alternative media (default: false) */
  removeAlternativeMedias?: boolean
  /** Remove images for alternative screen resolutions (default: true) */
  removeAlternativeImages?: boolean
  /** Group duplicate images together (default: true) */
  groupDuplicateImages?: boolean
  /** Save deferred images (default: true) */
  loadDeferredImages?: boolean
  /** Maximum idle time in ms for loading deferred images (default: 1500) */
  loadDeferredImagesMaxIdleTime?: number
  /** Maximum resource size in MB (default: 10) */
  maxResourceSize?: number
  /** Block scripts from   loading (default: true) */
  blockScripts?: boolean
  /** Block videos from loading (default: true) */
  blockVideos?: boolean
  /** Block audio from loading (default: true) */
  blockAudios?: boolean

  /** Maximum browser load time in ms (default: 60000) */
  browserLoadMaxTime?: number
  /** Browser wait until condition (default: 'networkIdle') */
  browserWaitUntil?: string
  /** Browser wait delay in ms (default: 0) */
  browserWaitDelay?: number
  /** Browser by pass CSP (default: true) */
  browserByPassCSP?: boolean
}

function createCdpOptions(options: SavePageOptions): Required<SavePageOptions> {
  return {
    browserLoadMaxTime: options.browserLoadMaxTime || 60000,
    browserWaitUntil: options.browserWaitUntil || 'networkIdle',
    browserWaitDelay: options.browserWaitDelay || 0,
    removeFrames: options.removeFrames ?? true,
    removeScripts: options.removeScripts ?? true,
    removeHidden: options.removeHidden ?? true,
    removeUnusedStyles: options.removeUnusedStyles ?? true,
    removeUnusedFonts: options.removeUnusedFonts ?? true,
    removeEmptyLines: options.removeEmptyLines ?? false,
    compressHTML: options.compressHTML ?? false,
    browserByPassCSP: options.browserByPassCSP ?? true,
    includeBOM: options.includeBOM ?? false,
    removeAlternativeFonts: options.removeAlternativeFonts ?? true,
    removeAlternativeMedias: options.removeAlternativeMedias ?? false,
    removeAlternativeImages: options.removeAlternativeImages ?? true,
    groupDuplicateImages: options.groupDuplicateImages ?? true,
    loadDeferredImages: options.loadDeferredImages ?? true,
    loadDeferredImagesMaxIdleTime:
      options.loadDeferredImagesMaxIdleTime ?? 1500,
    maxResourceSize: options.maxResourceSize ?? 10,
    blockScripts: options.blockScripts ?? true,
    blockVideos: options.blockVideos ?? true,
    blockAudios: options.blockAudios ?? true,
  } satisfies Required<SavePageOptions>
}
