import { DocumentNode } from 'graphql'
import { Accessor, createMemo } from 'solid-js'

import {
  TypedDocumentNode,
  GraphQLRequest,
  createRequest as createUrqlRequest,
} from '@urql/core'

/** Creates a request from a query and variables but preserves reference equality if the key isn't changing */
export function createRequest<Data = any, Variables = object>(
  query: string | DocumentNode | TypedDocumentNode<Data, Variables>,
  variables?: Variables
): Accessor<GraphQLRequest<Data, Variables>> {
  let prev: undefined | GraphQLRequest<Data, Variables> = undefined

  return createMemo(() => {
    const request = createUrqlRequest<Data, Variables>(query, variables)
    // We manually ensure reference equality if the key hasn't changed
    if (prev !== undefined && prev.key === request.key) {
      return prev
    } else {
      prev = request
      return request
    }
  })
}
