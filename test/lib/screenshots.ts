import { expect } from '@playwright/test'
import { readFile } from 'fs/promises'
import pixelmatch, { type PixelmatchOptions } from 'pixelmatch'
import { PNG } from 'pngjs'
import termImg from 'term-img'

export async function diffScreenshots(
  screenshot1: Buffer,
  screenshot2: Buffer,
  options?: PixelmatchOptions,
) {
  const png1 = PNG.sync.read(screenshot1)
  const png2 = PNG.sync.read(screenshot2)

  expect(png2.width, 'Width should be the same').toEqual(png1.width)
  expect(png2.height, 'Height should be the same').toEqual(png1.height)

  const outputPng = new PNG({ width: png1.width, height: png1.height })

  const diff = pixelmatch(
    png1.data,
    png2.data,
    outputPng.data,
    png1.width,
    png1.height,
    {
      threshold: 0.1,
      ...options,
    },
  )

  return { diff, output: PNG.sync.write(outputPng) }
}

export function logScreenshotDiff(og: Buffer, res: Buffer, diff: Buffer) {
  console.log('\n\n\n')

  process.stderr.write('Current:\n')
  process.stderr.write(termImg(og, { width: '50%', height: '50%' }))
  process.stderr.write('New:\n')
  process.stderr.write(termImg(res, { width: '50%', height: '50%' }))
  process.stderr.write('Diff:\n')
  process.stderr.write(termImg(diff, { width: '50%', height: '50%' }))
}

export async function compareScreenshots(
  screenshot1: Buffer,
  screenshot2: Buffer,
  options?: PixelmatchOptions,
) {
  const png1 = PNG.sync.read(screenshot1)
  const png2 = PNG.sync.read(screenshot2)

  expect(png2.width, 'Width should be the same').toEqual(png1.width)
  expect(png2.height, 'Height should be the same').toEqual(png1.height)

  const outputPng = new PNG({ width: png1.width, height: png1.height })

  const diff = pixelmatch(
    png1.data,
    png2.data,
    outputPng.data,
    png1.width,
    png1.height,
    {
      threshold: 0.1,
      ...options,
    },
  )

  const maxDiff = 10
  const didChange = diff > maxDiff
  if (didChange) {
    try {
      logScreenshotDiff(
        PNG.sync.write(png1),
        PNG.sync.write(png2),
        PNG.sync.write(outputPng),
      )
    } catch (error) {
      if (!String(error).includes('iTerm')) {
        console.error('Error logging screenshot diff', { error })
      }
    }
  }
  expect(
    didChange,
    `Screenshot changed, diff: ${diff}px\nPlease verify the change and run tests again with UPDATE_SCREENSHOTS=true to update the screenshots.`,
  ).toEqual(false)
}

export async function screenshotUrlToBuffer(
  screenshotUrl: string,
): Promise<Buffer> {
  if (screenshotUrl.startsWith('http')) {
    const response = await fetch(screenshotUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${screenshotUrl}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  try {
    const base64Header = 'base64,'
    const imageTypeHeaderIndex = screenshotUrl.indexOf(base64Header)

    if (imageTypeHeaderIndex < 0) {
      console.log(screenshotUrl)
      throw new Error('Invalid image data URL.')
    }

    return Buffer.from(
      screenshotUrl.substring(imageTypeHeaderIndex + base64Header.length),
      'base64',
    )
  } catch (error) {
    console.error('Error converting screenshotUrl to buffer', { error })
    throw error
  }
}

export async function logScreenshot(path: string, title?: string) {
  if (process.env.CI) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, 50))
  console.log('\n\n\n')
  if (title) {
    console.log('======', title, '======')
  }
  try {
    process.stderr.write(
      termImg(await screenshotUrlToBuffer(path), {
        width: '50%',
        height: '50%',
      }),
    )
  } catch (error) {
    if (!String(error).includes('iTerm')) {
      console.error('Error logging screenshot diff', { error })
    }
  }
  console.log('\n\n\n')
  await new Promise((resolve) => setTimeout(resolve, 50))
}

async function readPngFile(path: string) {
  const buf = await readFile(path)
  return PNG.sync.read(buf)
}
