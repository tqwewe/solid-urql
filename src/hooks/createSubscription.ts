import { DocumentNode } from 'graphql'
import { createSignal } from 'solid-js'

import { pipe, onEnd, subscribe } from 'wonka';


import {
  TypedDocumentNode,
  CombinedError,
  OperationContext,
  Operation,
} from '@urql/core'

import { useClient } from '../context'
import { createStore, Store, unwrap } from 'solid-js/store';
import { createRequest } from './createRequest';

export interface CreateSubscriptionArgs<Variables = object, Data = any> {
  query: DocumentNode | TypedDocumentNode<Data, Variables> | string
  variables?: Variables
  pause?: boolean
  context?: Partial<OperationContext>
}

export type SubscriptionHandler<T, R> = (prev: R | undefined, data: T) => R

export interface CreateSubscriptionState<Data = any, Variables = any> {
  fetching: boolean
  stale: boolean
  data?: Data | undefined
  error?: CombinedError | undefined
  extensions?: Record<string, any> | undefined
  operation?: Operation<Data, Variables>
}

export type CreateSubscriptionResponse<Data = any, Variables = object> = [
  Store<CreateSubscriptionState<Data, Variables>>,
  (opts?: Partial<OperationContext>) => void
]

export function createSubscription<
  Data = any,
  Result = Data,
  Variables = object
>(
  _args: CreateSubscriptionArgs<Variables, Data>,
  handler?: SubscriptionHandler<Data, Result>
): CreateSubscriptionResponse<Result, Variables> {

  const iniitalState = {
    fetching: false,
    stale: false,
    error: undefined,
    data: undefined,
    extensions: undefined,
    operation: undefined,
  };


  const client = useClient();
  const [args] = createSignal(_args)

  const request = createRequest(args().query, args().variables);

  const [state, setState] = createStore<CreateSubscriptionState>(iniitalState);

  const createSource = (opts?: Partial<OperationContext>) =>
    client.executeSubscription<Data, Variables>(request(), {
      ...args().context,
      ...opts,
    });

  const source = !args().pause ? createSource() : undefined


  if (source) {
    setState("fetching", true);
    pipe(
      source,
      onEnd(() => {
        setState("fetching", false)
      }),
      subscribe(result => {
        setState("fetching", true);
        const data =
          result.data !== undefined
            ? (typeof handler === 'function'
              ? handler(state.data, result.data)
              : result.data)
            : (result.data as any)

        setState("error", result?.error);
        setState("data", data);
        setState("operation", result.operation);
        setState("extensions", result.extensions);
        setState("stale", !!result.stale);
      })
    ).unsubscribe
  } else {
    setState("fetching", false);
  }

  return [unwrap(state), createSource]
}
