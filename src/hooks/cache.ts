import { pipe, subscribe } from 'wonka'

import { Client, OperationResult } from '@urql/core'

type CacheEntry = OperationResult | Promise<unknown> | undefined

interface Cache {
  get(key: number): CacheEntry
  set(key: number, value: CacheEntry): void
  dispose(key: number): void
}

interface ClientWithCache extends Client {
  _solid?: Cache
}

export const getCacheForClient = (client: Client): Cache => {
  if (!(client as ClientWithCache)._solid) {
    const reclaim = new Set()
    const map = new Map<number, CacheEntry>()

    if (client.operations$ /* not available in mocks */) {
      pipe(
        client.operations$,
        subscribe((operation) => {
          if (operation.kind === 'teardown' && reclaim.has(operation.key)) {
            reclaim.delete(operation.key)
            map.delete(operation.key)
          }
        })
      )
    }

    ;(client as ClientWithCache)._solid = {
      get(key) {
        return map.get(key)
      },
      set(key, value) {
        reclaim.delete(key)
        map.set(key, value)
      },
      dispose(key) {
        reclaim.add(key)
      },
    }
  }

  return (client as ClientWithCache)._solid!
}
