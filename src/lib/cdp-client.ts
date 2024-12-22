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

/* global setTimeout, clearTimeout */

import { Page, type CDPSession } from 'playwright-core'
import { getScriptSource, getHookScriptSource } from './single-file-script.js'
import type { SavePageOptions } from '../index.js'
import type { Protocol } from 'playwright-core/types/protocol'
import console from 'console'

const LOAD_TIMEOUT_ERROR = 'ERR_LOAD_TIMEOUT'
const CAPTURE_TIMEOUT_ERROR = 'ERR_CAPTURE_TIMEOUT'
const NETWORK_STATES = [
  'InteractiveTime',
  'networkIdle',
  'networkAlmostIdle',
  'load',
  'DOMContentLoaded',
]
const SINGLE_FILE_WORLD_NAME = 'singlefile'
const SET_PAGE_DATA_FUNCTION_NAME = 'setPageData'

interface CDPContext {
  id: number
  name: string
  origin: string
}

interface CDPEvaluateResult {
  result: {
    subtype?: string
    description?: string
  }
}

declare global {
  interface Window {
    singlefile: {
      getPageData: (options: any) => Promise<any>
    }
  }
}

interface PageData {
  content: string | number[]
  title?: string
  doctype?: string
  url?: string
}

export interface GetPageDataOptions extends Required<SavePageOptions> {}

class CDPManager {
  cdpClient: CDPSession
  private page: Page
  private constructor(page: Page, cdpClient: CDPSession) {
    this.page = page
    this.cdpClient = cdpClient
    this.onExecutionContextCreated = this.onExecutionContextCreated.bind(this)
    this.onExecutionContextDestroyed =
      this.onExecutionContextDestroyed.bind(this)
  }

  contextIds = new Set<number>()

  static async create(page: Page, options: GetPageDataOptions) {
    const cdpClient = await page.context().newCDPSession(page)

    const manager = new CDPManager(page, cdpClient)

    return manager
  }

  async setupHandlers() {
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

  async removeHandlers() {
    this.cdpClient.off(
      'Runtime.executionContextCreated',
      this.onExecutionContextCreated,
    )
    this.cdpClient.off(
      'Runtime.executionContextDestroyed',
      this.onExecutionContextDestroyed,
    )
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

  private cleanups: (() => Promise<void>)[] = []
  async addScriptToEvaluateOnNewDocument(
    params: Protocol.Page.addScriptToEvaluateOnNewDocumentParameters,
  ) {
    const { identifier } = await this.cdpClient.send(
      'Page.addScriptToEvaluateOnNewDocument',
      params,
    )
    this.cleanups.push(async () => {
      await this.cdpClient.send('Page.removeScriptToEvaluateOnNewDocument', {
        identifier,
      })
    })
  }

  async testExecutionContext(contextId: number) {
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
  async getContextId() {
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

    this.cleanups.push(async () => {
      await this.cdpClient.send('Runtime.removeBinding', {
        name,
      })
    })
  }

  addCleanup(cleanup: () => Promise<void>) {
    this.cleanups.push(cleanup)
  }

  async cleanup() {
    await Promise.all(this.cleanups.map((cleanup) => cleanup()))
  }
}

export async function getPageData(page: Page, options: GetPageDataOptions) {
  const manager = await CDPManager.create(page, options)
  const cdpClient = manager.cdpClient

  try {
    // Add hook script in main world
    await manager.addScriptToEvaluateOnNewDocument({
      source: getHookScriptSource(),
      runImmediately: true,
    })

    await manager.setupHandlers()
    // Add SingleFile script in isolated world
    await manager.addScriptToEvaluateOnNewDocument({
      source: await getScriptSource(options),
      runImmediately: true,
      worldName: SINGLE_FILE_WORLD_NAME,
    })

    const contextId = await manager.getContextId()

    // Add binding for page data
    await manager.addBinding(SET_PAGE_DATA_FUNCTION_NAME, contextId)

    // Execute SingleFile in the isolated world
    let pageDataResponse = ''
    function onBindingCalled(params: any) {
      if (params.name === SET_PAGE_DATA_FUNCTION_NAME) {
        const { payload } = params
        if (payload.length) {
          pageDataResponse += payload
        } else {
          const result = JSON.parse(pageDataResponse)
          if (result.content instanceof Array) {
            result.content = new Uint8Array(result.content)
          }
          pageDataResponse = result
        }
      }
    }
    cdpClient.on('Runtime.bindingCalled', onBindingCalled)
    manager.addCleanup(async () => {
      cdpClient.off('Runtime.bindingCalled', onBindingCalled)
    })

    // Execute the page data script
    const { result } = (await cdpClient.send('Runtime.evaluate', {
      expression: `(${getPageDataScriptSource.toString()})(${JSON.stringify(
        options,
      )}, "${SET_PAGE_DATA_FUNCTION_NAME}")`,
      awaitPromise: true,
      contextId,
    })) as CDPEvaluateResult

    if (result.subtype === 'error') {
      throw new Error(result.description || 'Unknown error')
    }

    return pageDataResponse as unknown as PageData
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

async function getIsolatedContextId(
  cdpClient: CDPSession,
  frameId: string,
  worldName: string,
): Promise<number> {
  const { executionContextId } = await cdpClient.send(
    'Page.createIsolatedWorld',
    {
      frameId,
      worldName,
    },
  )
  return executionContextId
}

function getPageDataScriptSource(
  options: any,
  setPageDataFunctionName: string,
) {
  const MAX_CONTENT_SIZE = 32 * 1024 * 1024
  return window.singlefile.getPageData(options).then((data: any) => {
    if (data.content instanceof Uint8Array) {
      data.content = Array.from(data.content)
    }
    data = JSON.stringify(data)
    let indexData = 0
    do {
      // @ts-ignore
      globalThis[setPageDataFunctionName](
        data.slice(indexData, indexData + MAX_CONTENT_SIZE),
      )
      indexData += MAX_CONTENT_SIZE
    } while (indexData < data.length)
    // @ts-ignore
    globalThis[setPageDataFunctionName]('')
  })
}
