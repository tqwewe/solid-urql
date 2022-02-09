import { DocumentNode } from 'graphql'
import {
  Accessor,
  createEffect,
  createMemo,
  onCleanup,
  untrack,
} from 'solid-js'
import { createStore } from 'solid-js/store'

import { Source, pipe, subscribe, onEnd, onPush, takeWhile } from 'wonka'

import {
  Client,
  TypedDocumentNode,
  CombinedError,
  OperationContext,
  RequestPolicy,
  OperationResult,
  Operation,
} from '@urql/core'

import { GraphQLRequest } from '..'
import { useClient } from '../context'
import { getCacheForClient } from './cache'
import { createRequest } from './createRequest'
import { initialState, computeNextState, hasDepsChanged } from './state'

export interface CreateQueryArgs<Variables = object, Data = any> {
  query: string | DocumentNode | TypedDocumentNode<Data, Variables>
  variables?: Variables
  requestPolicy?: RequestPolicy
  context?: Partial<OperationContext>
  pause?: boolean
}

export interface CreateQueryState<Data = any, Variables = object> {
  fetching: boolean
  stale: boolean
  data?: Data
  error?: CombinedError
  extensions?: Record<string, any>
  operation?: Operation<Data, Variables>
}

export type CreateQueryResponse<Data = any, Variables = object> = [
  Accessor<Data | undefined>,
  Accessor<CreateQueryState<Data, Variables>>,
  (opts?: Partial<OperationContext>) => void
]

type Deps<Data = any, Variables = object> = readonly [
  Client,
  GraphQLRequest<Data, Variables>,
  RequestPolicy | undefined,
  Partial<OperationContext> | undefined,
  boolean | undefined
]

const isSuspense = (client: Client, context?: Partial<OperationContext>) =>
  client.suspense && (!context || context.suspense !== false)

let currentInit = false

export function createQuery<Data = any, Variables = object>(
  args: CreateQueryArgs<Variables, Data>
): CreateQueryResponse<Data, Variables> {
  const client = useClient()
  const cache = getCacheForClient(client)
  const suspense = isSuspense(client, args.context)
  const request = createRequest<Data, Variables>(args.query, args.variables)

  const source = createMemo(() => {
    JSON.stringify(args.context)

    if (args.pause) return null

    const source = client.executeQuery(request(), {
      requestPolicy: args.requestPolicy,
      ...args.context,
    })

    return suspense
      ? pipe(
          source,
          onPush((result) => {
            cache.set(request().key, result)
          })
        )
      : source
  })

  const getSnapshot = (
    source: Source<OperationResult<Data, Variables>> | null,
    suspense: boolean
  ): Partial<CreateQueryState<Data, Variables>> => {
    if (!source) return { fetching: false }

    let result = cache.get(request().key)
    if (!result) {
      let resolve: (value: unknown) => void

      const subscription = pipe(
        source,
        takeWhile(() => (suspense && !resolve) || !result),
        subscribe((_result) => {
          result = _result
          if (resolve) resolve(result)
        })
      )

      if (result == null && suspense) {
        const promise = new Promise((_resolve) => {
          resolve = _resolve
        })

        cache.set(request().key, promise)
        throw promise
      } else {
        subscription.unsubscribe()
      }
    } else if (suspense && result != null && 'then' in result) {
      throw result
    }

    return (result as OperationResult<Data, Variables>) || { fetching: true }
  }

  const deps: Deps<Data, Variables> = [
    client,
    request(),
    args.requestPolicy,
    args.context,
    args.pause,
  ]

  const [state, setState] = createStore(
    (() => {
      currentInit = true
      try {
        return {
          source: source(),
          nextState: computeNextState(
            initialState,
            getSnapshot(source, suspense)
          ),
          deps,
        }
      } finally {
        currentInit = false
      }
    })()
  )

  if (source !== state.source && hasDepsChanged(state.deps, deps)) {
    const nextState = computeNextState(
      state.nextState,
      getSnapshot(source, suspense)
    )
    setState({ nextState })
  }

  createEffect(() => {
    const source = state.source
    const request = state.deps[1]

    let hasResult = false

    const updateResult = (
      result: Partial<CreateQueryState<Data, Variables>>
    ) => {
      hasResult = true
      if (!currentInit) {
        untrack(() => {
          const nextState = computeNextState(state.nextState, result)
          setState({ nextState })
        })
      }
    }

    if (source) {
      const subscription = pipe(
        source,
        onEnd(() => {
          updateResult({ fetching: false })
        }),
        subscribe(updateResult)
      )

      if (!hasResult) updateResult({ fetching: true })

      onCleanup(() => {
        cache.dispose(request.key)
        subscription.unsubscribe()
      })
    } else {
      updateResult({ fetching: false })
    }
  })

  const executeQuery = (opts?: Partial<OperationContext>) => {
    const context = {
      requestPolicy: args.requestPolicy,
      ...args.context,
      ...opts,
    }

    const source = suspense
      ? pipe(
          client.executeQuery(request(), context),
          onPush((result) => {
            cache.set(request().key, result)
          })
        )
      : client.executeQuery(request(), context)

    setState({ source })
  }

  const dataAccessor = () => {
    return state.nextState?.data as Data
  }

  return [dataAccessor, () => state.nextState, executeQuery]
}
