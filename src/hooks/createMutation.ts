import { DocumentNode } from 'graphql'
import { createSignal, createEffect, onCleanup, Accessor } from 'solid-js'

import { pipe, toPromise } from 'wonka'

import {
  TypedDocumentNode,
  OperationResult,
  OperationContext,
  CombinedError,
  createRequest,
  Operation,
} from '@urql/core'

import { useClient } from '../context'
import { initialState } from './state'

export interface CreateMutationState<Data = any, Variables = object> {
  fetching: boolean
  stale: boolean
  data?: Data
  error?: CombinedError
  extensions?: Record<string, any>
  operation?: Operation<Data, Variables>
}

export type CreateMutationResponse<Data = any, Variables = object> = [
  Accessor<CreateMutationState<Data, Variables>>,
  (
    variables?: Variables,
    context?: Partial<OperationContext>
  ) => Promise<OperationResult<Data, Variables>>
]

export function createMutation<Data = any, Variables = object>(
  query: DocumentNode | TypedDocumentNode<Data, Variables> | string
): CreateMutationResponse<Data, Variables> {
  const [isMounted, setIsMounted] = createSignal(true)
  const client = useClient()

  const [state, setState] =
    createSignal<CreateMutationState<Data, Variables>>(initialState)

  const executeMutation = (
    variables?: Variables,
    context?: Partial<OperationContext>
  ) => {
    setState({ ...initialState, fetching: true })

    return pipe(
      client.executeMutation<Data, Variables>(
        createRequest<Data, Variables>(query, variables),
        context || {}
      ),
      toPromise
    ).then((result) => {
      if (isMounted()) {
        setState({
          fetching: false,
          stale: !!result.stale,
          data: result.data,
          error: result.error,
          extensions: result.extensions,
          operation: result.operation,
        })
      }
      return result
    })
  }

  onCleanup(() => {
    setIsMounted(false)
  })

  return [state, executeMutation]
}
