import type { PluginContext } from '@rcv-prod-toolkit/types'
import { InGameState } from './controller/InGameState'
import type { AllGameData } from './types/AllGameData'
import type { Config } from './types/Config'

module.exports = async (ctx: PluginContext) => {
  const namespace = ctx.plugin.module.getName()

  const configRes = await ctx.LPTE.request({
    meta: {
      type: 'request',
      namespace: 'plugin-config',
      version: 1
    }
  })
  if (configRes === undefined) {
    ctx.log.warn('config could not be loaded')
  }
  let config: Config = Object.assign(
    {
      items: [],
      level: [],
      events: [],
      killfeed: false,
      ppTimer: false,
      showNicknames: false,
      delay: 0
    },
    configRes?.config
  )

  ctx.LPTE.on(namespace, 'set-settings', (e) => {
    config.items = e.items
    config.level = e.level
    config.events = e.events
    config.killfeed = e.killfeed
    config.ppTimer = e.ppTimer
    config.delay = e.delay
    config.showNicknames = e.showNicknames

    ctx.LPTE.emit({
      meta: {
        type: 'set',
        namespace: 'plugin-config',
        version: 1
      },
      config: {
        items: e.items,
        level: e.level,
        events: e.events,
        killfeed: e.killfeed,
        ppTimer: e.ppTimer,
        delay: e.delay,
        showNicknames: e.showNicknames
      }
    })
  })

  ctx.LPTE.on(namespace, 'get-settings', (e) => {
    ctx.LPTE.emit({
      meta: {
        type: e.meta.reply!,
        namespace: 'reply',
        version: 1
      },
      items: config.items,
      level: config.level,
      events: config.events,
      killfeed: config.killfeed,
      ppTimer: config.ppTimer,
      delay: config.delay,
      showNicknames: config.showNicknames
    })
  })

  ctx.LPTE.emit({
    meta: {
      type: 'add-pages',
      namespace: 'ui',
      version: 1
    },
    pages: [
      {
        name: 'LoL: In-Game',
        frontend: 'frontend',
        id: `op-${namespace}`
      }
    ]
  })

  let inGameState: InGameState

  ctx.LPTE.on('module-league-static', 'static-loaded', async (e) => {
    const statics = e.constants

    const stateRes = await ctx.LPTE.request({
      meta: {
        type: 'request',
        namespace: 'module-league-state',
        version: 1
      }
    })
    const state = stateRes?.state

    ctx.LPTE.on('lcu', 'lcu-champ-select-create', () => {
      inGameState = new InGameState(namespace, ctx, config, state, statics)
    })

    ctx.LPTE.on(namespace, 'allgamedata', (e) => {
      if (inGameState === undefined) {
        inGameState = new InGameState(namespace, ctx, config, state, statics)
      }

      const data = e.data as AllGameData
      inGameState.handelData(data)
    })

    ctx.LPTE.on(namespace, 'live-events', (e) => {
      if (inGameState === undefined) {
        inGameState = new InGameState(namespace, ctx, config, state, statics)
      }

      e.data.forEach((event: any) => {
        inGameState.handelEvent(event)
      })
    })

    ctx.LPTE.on(namespace, 'request', (e) => {
      if (inGameState === undefined) {
        inGameState = new InGameState(namespace, ctx, config, state, statics)
      }

      ctx.LPTE.emit({
        meta: {
          type: e.meta.reply as string,
          namespace: 'reply',
          version: 1
        },
        state: inGameState.gameState
      })
    })
  })

  ctx.LPTE.on(namespace, 'show-inhibs', (e) => {
    if (inGameState === undefined) return
    const side = parseInt(e.side) as any
    inGameState.gameState.showInhibitors = side
  })
  ctx.LPTE.on(namespace, 'show-platings', (e) => {
    if (inGameState === undefined) return
    inGameState.gameState.platings.showPlatings = true
  })

  ctx.LPTE.on(namespace, 'hide-inhibs', (e) => {
    if (inGameState === undefined) return
    inGameState.gameState.showInhibitors = null
  })
  ctx.LPTE.on(namespace, 'hide-platings', (e) => {
    if (inGameState === undefined) return
    inGameState.gameState.platings.showPlatings = false
  })

  // Emit event that we're ready to operate
  ctx.LPTE.emit({
    meta: {
      type: 'plugin-status-change',
      namespace: 'lpt',
      version: 1
    },
    status: 'RUNNING'
  })
}
