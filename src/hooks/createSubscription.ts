import { DocumentNode } from 'graphql'
import { createEffect } from 'solid-js'

import { pipe, concat, fromValue, switchMap, map, scan } from 'wonka';

import {
  TypedDocumentNode,
  CombinedError,
  OperationContext,
  Operation,
} from '@urql/core'

import { useClient } from '../context'
import { createRequest } from './createRequest'
import { createSource } from './createSoruce'
import { initialState } from './state'

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

export function createSubscription<
  Data = any,
  Result = Data,
  Variables = object
>(
  args: CreateSubscriptionArgs<Variables, Data>,
  handler?: SubscriptionHandler<Data, Result>
): CreateSubscriptionResponse<Result, Variables> {

  const client = useClient();
  const request = createRequest<Data, Variables>(args.query, args.variables);

  const makeSubscription$ = (opts?: Partial<OperationContext>) => {
      return client.executeSubscription<Data, Variables>(request(), {
        ...args.context,
        ...opts,
      });
  };

  const subscription$ = args.pause ? null : makeSubscription$();

  const [state$, update] = createSource(
    subscription$,
    ((subscription$$, prevState?: CreateSubscriptionState<Result, Variables>) => {
      return pipe(
        subscription$$,
        switchMap((subscription$) => {
          if (!subscription$) return fromValue({ fetching: false });
          return concat([
            // Initially set fetching to true
            fromValue({ fetching: true, stale: false }),
            pipe(
              subscription$,
              map(({ stale, data, error, extensions, operation }) => ({
                fetching: true,
                stale: !!stale,
                data,
                error,
                extensions,
                operation,
              }))
            ),
            // When the source proactively closes, fetching is set to false
            fromValue({ fetching: false, stale: false }),
          ]);
        }),
        scan(
          (result: CreateSubscriptionState<Result, Variables>, partial: any) => {
            // If a handler has been passed, it's used to merge new data in
            const data =
              partial.data !== undefined
                ? typeof handler === 'function'
                  ? handler(result.data, partial.data)
                  : partial.data
                : result.data;
            return { ...result, ...partial, data };
          },
          prevState || initialState
        )
      )
    })
  )

  createEffect(() => {
    update(subscription$)
  })

  const executeSubscription = (opts?: Partial<OperationContext>) => update(makeSubscription$(opts));


  return [state$, executeSubscription]
}
