/*
 * Copyright 2010-2024 Gildas Lormeau
 * contact : gildas.lormeau <at> gmail.com
 *
 * This file is part of SingleFile.
 *
 *   The code in this file is free software: you can redistribute it and/or
 *   modify it under the terms of the GNU Affero General Public License
 *   (GNU AGPL) as published by the Free Software Foundation, either version 3
 *   of the License, or (at your option) any later version.
 *
 *   The code in this file is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
 *   General Public License for more details.
 *
 *   As additional permission under GNU AGPL version 3 section 7, you may
 *   distribute UNMODIFIED VERSIONS OF THIS file without the copy of the GNU
 *   AGPL normally required by section 4, provided you include this license
 *   notice and a URL through which recipients can access the Corresponding
 *   Source.
 */

import { Page, type CDPSession } from 'playwright-core'
import type { Protocol } from 'playwright-core/types/protocol'
import type { SavePageOptions } from '../index.js'
import { getHookScriptSource, getScriptSource } from './single-file-script.js'
import assert from 'assert'

const SINGLE_FILE_WORLD_NAME = 'singlefile' as const
const SET_PAGE_DATA_FUNCTION_NAME = 'setPageData' as const
const SEND_MESSAGE_FUNCTION_NAME = 'sendMessage' as const

interface CDPEvaluateResult {
  result: {
    subtype?: string
    description?: string
  }
}

declare global {
  interface Window {
    singlefile: {
      getPageData: (options: SavePageOptions) => Promise<PageData>
    }
    [SET_PAGE_DATA_FUNCTION_NAME]: (data: string) => void
    [SEND_MESSAGE_FUNCTION_NAME]: (data: string) => void
  }
}

type PageDataStatsContent = {
  'HTML bytes'?: number
  'hidden elements'?: number
  scripts?: number
  objects?: number
  'audio sources'?: number
  'video sources'?: number
  frames?: number
  'CSS rules'?: number
  canvas?: number
  stylesheets?: number
  resources?: number
  medias?: number
} & Record<string, number>

type PageDataStats = {
  processed: PageDataStatsContent
  discarded: PageDataStatsContent
}

interface PageDataBase {
  title?: string
  doctype?: string
  url?: string
  stats?: PageDataStats
}

interface PageDataWIP extends PageDataBase {
  content: string | number[] | Uint8Array
}

export interface PageData extends PageDataBase {
  content: string
}

export type GetPageDataOptions = Required<SavePageOptions>

type CleanupFn = () => Promise<unknown> | unknown
class CDPManager {
  cdpClient: CDPSession
  private page: Page | null
  private constructor(page: Page, cdpClient: CDPSession) {
    this.page = page
    this.cdpClient = cdpClient
    this.onExecutionContextCreated = this.onExecutionContextCreated.bind(this)
    this.onExecutionContextDestroyed =
      this.onExecutionContextDestroyed.bind(this)
  }

  contextIds = new Set<number>()

  static async create(page: Page) {
    const cdpClient = await page.context().newCDPSession(page)

    const manager = new CDPManager(page, cdpClient)

    return manager
  }

  async catchContextId<T>(
    innerFn: () => Promise<T>,
  ): Promise<{ result: T; contextId: number }> {
    try {
      await this.setupHandlers()
      const result = await innerFn()
      const contextId = await this.getContextId()
      return { result, contextId }
    } catch (e) {
      console.error(e)
      throw e
    } finally {
      await this.removeHandlers()
    }
  }

  private async setupHandlers() {
    await this.cdpClient.send('Runtime.enable')
    await this.cdpClient.send('Page.setLifecycleEventsEnabled', {
      enabled: true,
    })
    this.cdpClient.on(
      'Runtime.executionContextCreated',
      this.onExecutionContextCreated,
    )

    this.cdpClient.on(
      'Runtime.executionContextDestroyed',
      this.onExecutionContextDestroyed,
    )
  }

  private async removeHandlers() {
    this.cdpClient.off(
      'Runtime.executionContextCreated',
      this.onExecutionContextCreated,
    )
    this.cdpClient.off(
      'Runtime.executionContextDestroyed',
      this.onExecutionContextDestroyed,
    )

    await this.cdpClient.send('Page.setLifecycleEventsEnabled', {
      enabled: false,
    })
    await this.cdpClient.send('Runtime.disable')
  }

  private async onExecutionContextDestroyed(
    params: Protocol.Runtime.executionContextDestroyedPayload,
  ) {
    const { executionContextId } = params
    this.contextIds.delete(executionContextId)
  }

  private onExecutionContextCreated(
    params: Protocol.Runtime.executionContextCreatedPayload,
  ) {
    const { id } = params.context
    this.contextIds.add(id)
  }

  private cleanups: CleanupFn[] = []
  async addScriptToEvaluateOnNewDocument(
    params: Protocol.Page.addScriptToEvaluateOnNewDocumentParameters,
  ) {
    const { identifier } = await this.cdpClient.send(
      'Page.addScriptToEvaluateOnNewDocument',
      params,
    )
    this.addCleanup(() =>
      this.cdpClient.send('Page.removeScriptToEvaluateOnNewDocument', {
        identifier,
      }),
    )
  }

  private async testExecutionContext(contextId: number) {
    try {
      const { result } = await this.cdpClient.send('Runtime.evaluate', {
        expression: 'singlefile !== undefined',
        contextId,
      })
      return result.value === true
    } catch {
      // ignored
    }
    return false
  }

  private _contextId?: number
  private async getContextId() {
    if (this._contextId) {
      return this._contextId
    }

    let contextId
    const contextIds = Array.from(this.contextIds)
    if (contextIds.length) {
      let contextIdIndex = 0
      do {
        if (await this.testExecutionContext(contextIds[contextIdIndex]!)) {
          contextId = contextIds[contextIdIndex]
        }
        contextIdIndex++
      } while (contextId === undefined && contextIdIndex < contextIds.length)
    }

    if (!contextId) {
      throw new Error('No context id found')
    }

    await this.removeHandlers()

    this._contextId = contextId
    return contextId
  }

  async addBinding(name: string, executionContextId: number) {
    await this.cdpClient.send('Runtime.addBinding', {
      name,
      executionContextId,
    })

    this.addCleanup(() =>
      this.cdpClient.send('Runtime.removeBinding', {
        name,
      }),
    )
  }

  addCleanup(cleanupFn: CleanupFn) {
    this.cleanups.push(cleanupFn)
  }

  withCleanup<T>(fn: () => T, cleanupFn: CleanupFn) {
    this.addCleanup(cleanupFn)
    return fn()
  }

  async cleanup() {
    for (const cleanupFn of this.cleanups) {
      try {
        await cleanupFn()
      } catch (e) {
        console.error('Error cleaning up', e)
      }
    }

    this.cleanups = []
    this.page = null
  }
}

export async function getPageData(page: Page, options: GetPageDataOptions) {
  const manager = await CDPManager.create(page)
  const cdpClient = manager.cdpClient

  try {
    // Add hook script in main world
    await manager.addScriptToEvaluateOnNewDocument({
      source: getHookScriptSource(),
      runImmediately: true,
    })

    const { contextId } = await manager.catchContextId(async () => {
      // Add SingleFile script in isolated world
      await manager.addScriptToEvaluateOnNewDocument({
        source: await getScriptSource(options),
        runImmediately: true,
        worldName: SINGLE_FILE_WORLD_NAME,
      })
    })

    // Add binding for page data
    await manager.addBinding(SET_PAGE_DATA_FUNCTION_NAME, contextId)
    await manager.addBinding(SEND_MESSAGE_FUNCTION_NAME, contextId)

    // Execute SingleFile in the isolated world
    let pageDataResponse: PageDataWIP | string = ''
    function onBindingCalled(params: { name: string; payload: string }) {
      if (params.name === SEND_MESSAGE_FUNCTION_NAME) {
        // TODO: Implement
      }
      if (params.name === SET_PAGE_DATA_FUNCTION_NAME) {
        const { payload } = params
        if (payload.length) {
          pageDataResponse += payload
        } else {
          const result = JSON.parse(pageDataResponse as string) as PageDataWIP
          if (result.content instanceof Array) {
            result.content = new Uint8Array(result.content)
          }
          pageDataResponse = result
        }
      }
    }

    manager.withCleanup(
      () => cdpClient.on('Runtime.bindingCalled', onBindingCalled),
      () => cdpClient.off('Runtime.bindingCalled', onBindingCalled),
    )

    // Execute the page data script
    const { result } = (await cdpClient.send('Runtime.evaluate', {
      expression: `(${getPageDataScriptSource.toString()})(${JSON.stringify(
        options,
      )},${JSON.stringify([
        SET_PAGE_DATA_FUNCTION_NAME,
        SEND_MESSAGE_FUNCTION_NAME,
      ])})`,
      awaitPromise: true,
      returnByValue: true,
      contextId,
    })) as CDPEvaluateResult

    if (result.subtype === 'error') {
      throw new Error(result.description || 'Unknown error')
    }

    assert(typeof pageDataResponse === 'object', 'Page data is not an object')

    pageDataResponse = pageDataResponse as PageDataWIP

    const content =
      typeof pageDataResponse.content === 'string'
        ? pageDataResponse.content
        : new TextDecoder().decode(new Uint8Array(pageDataResponse.content))

    pageDataResponse.content = content
    return pageDataResponse as PageData
  } finally {
    try {
      await manager.cleanup()
    } catch (e) {
      console.error('Error cleaning up CDP client', e)
    }
    await cdpClient.detach().catch((e) => {
      console.error('Error detaching CDP client', e)
    })
  }
}

type FunctionNames = [
  typeof SET_PAGE_DATA_FUNCTION_NAME,
  typeof SEND_MESSAGE_FUNCTION_NAME,
]

type SingleFileProgressEvent = {
  type: string
  detail: Record<string, unknown>
  progress: number
}

function getPageDataScriptSource(
  options: GetPageDataOptions & {
    onprogress: (event: SingleFileProgressEvent) => void
  },
  [SET_PAGE_DATA_FUNCTION_NAME, SEND_MESSAGE_FUNCTION_NAME]: FunctionNames,
) {
  const MAX_CONTENT_SIZE = 32 * 1024 * 1024 // 32MB
  options.onprogress = async (event: SingleFileProgressEvent) => {
    window[SEND_MESSAGE_FUNCTION_NAME](
      JSON.stringify({
        type: event.type,
        keys: Object.keys(event),
        details: Object.keys(event.detail),
        step: event.detail.step,
        progress: event.progress,
      }),
    )
  }

  return window.singlefile.getPageData(options).then((data: any) => {
    if (data.content instanceof Uint8Array) {
      data.content = Array.from(data.content)
    }
    data = JSON.stringify(data)
    let indexData = 0
    do {
      window[SET_PAGE_DATA_FUNCTION_NAME](
        data.slice(indexData, indexData + MAX_CONTENT_SIZE),
      )
      indexData += MAX_CONTENT_SIZE
    } while (indexData < data.length)

    window[SET_PAGE_DATA_FUNCTION_NAME]('')
  })
}
