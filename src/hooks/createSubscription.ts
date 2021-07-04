import { DocumentNode } from 'graphql'
import { createEffect, createMemo, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'

import { pipe, subscribe, onEnd } from 'wonka'

import {
  TypedDocumentNode,
  CombinedError,
  OperationContext,
  Operation,
} from '@urql/core'

import { Client } from '..'
import { useClient } from '../context'
import { createRequest } from './createRequest'
import { initialState, computeNextState, hasDepsChanged } from './state'

export interface CreateSubscriptionArgs<Variables = object, Data = any> {
  query: DocumentNode | TypedDocumentNode<Data, Variables> | string
  variables?: Variables
  pause?: boolean
  context?: Partial<OperationContext>
}

export type SubscriptionHandler<T, R> = (prev: R | undefined, data: T) => R

export interface CreateSubscriptionState<Data = any, Variables = object> {
  fetching: boolean
  stale: boolean
  data?: Data
  error?: CombinedError
  extensions?: Record<string, any>
  operation?: Operation<Data, Variables>
}

export type CreateSubscriptionResponse<Data = any, Variables = object> = [
  CreateSubscriptionState<Data, Variables>,
  (opts?: Partial<OperationContext>) => void
]

type Deps<Data = any, Variables = object> = readonly [
  Client,
  any,
  Partial<OperationContext> | undefined,
  boolean | undefined
]

export function createSubscription<
  Data = any,
  Result = Data,
  Variables = object
>(
  args: CreateSubscriptionArgs<Variables, Data>,
  handler?: SubscriptionHandler<Data, Result>
): CreateSubscriptionResponse<Result, Variables> {
  const client = useClient()
  const request = createRequest<Data, Variables>(args.query, args.variables)

  let handlerRef: SubscriptionHandler<Data, Result> | undefined = handler

  const source = createMemo(() =>
    !args.pause ? client.executeSubscription(request(), args.context) : null
  )

  const deps = [client, request, args.context, args.pause] as const

  const [state, setState] = createStore(() => ({
    source,
    state: { ...initialState, fetching: !!source },
    deps,
  }))

  let currentResult = state().state
  if (source !== state().source && hasDepsChanged(state().deps, deps)) {
    setState([
      source(),
      (currentResult = computeNextState(state().state, {
        fetching: !!source,
      })),
      deps,
    ])
  }

  createEffect(() => {
    const source = state().source

    const updateResult = (
      result: Partial<CreateSubscriptionState<Data, Variables>>
    ) => {
      untrack(() => {
        setState((state) => {
          const nextResult = computeNextState(state().state, result)
          if (state().state === nextResult) return state
          if (handlerRef && state().state.data !== nextResult.data) {
            nextResult.data = handlerRef(
              state().state.data,
              nextResult.data!
            ) as any
          }

          return {
            source: state().source,
            state: nextResult as any,
            deps: state().deps,
          }
        })
      })
    }

    if (source) {
      const subscription = pipe(
        source,
        onEnd(() => {
          updateResult({ fetching: false })
        }) as any,
        subscribe(updateResult)
      )

      return () => subscription.unsubscribe()
    } else {
      updateResult({ fetching: false })
    }
  })

  // This is the imperative execute function passed to the user
  const executeSubscription = (opts?: Partial<OperationContext>) => {
    const source = client.executeSubscription(request(), {
      ...args.context,
      ...opts,
    })

    setState((state) => ({
      source,
      state: state().state,
      deps: state().deps,
    }))
  }

  return [currentResult, executeSubscription]
}
