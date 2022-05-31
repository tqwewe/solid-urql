import { merge, fromValue, never, empty } from 'wonka';
import { createSubscription } from './createSubscription';
import { Component as C } from 'solid-js';
import { Provider } from '../context'
import { render, cleanup } from 'solid-testing-library';
import { OperationContext } from '@urql/core';
import h from 'solid-js/h'

declare global {
  var _$HY: Record<string, any>;
}

globalThis._$HY = {};

let state: any;
let execute: any;

const SubscriptionUser: C<{
  q: string;
  handler?: (prev: any, data: any) => any;
  context?: Partial<OperationContext>;
  pause?: boolean;
}> = ({ q, handler, context, pause = false }) => {
  [state, execute] = createSubscription({ query: q, context, pause }, handler);
  return h("p", {}, state.data);
};

const query = 'subscription Example { example }';

const data = { data: 1234, error: 5678 };
const mock = {
  // @ts-ignore
  executeSubscription: jest.fn(() => merge([fromValue(data), never])),
};

const client = mock as { executeSubscription: jest.Mock };


beforeAll(() => {
  jest.spyOn(global.console, 'error').mockImplementation();
});

describe('createSubscription', () => {
  beforeEach(() => {
    client.executeSubscription.mockClear();
    state = undefined;
    execute = undefined;
  });
  afterEach(() => cleanup());

  const props = { q: query };

  it("executes subscription", async () => {
    render(h(Provider, {
      value: client,
      children: [h(SubscriptionUser, { ...props })]
    }))
    expect(client.executeSubscription).toBeCalledTimes(1);
  });

  it('should support setting context in useSubscription params', () => {
    render(
      h(Provider, {
        value: client as any,
        children: [h(SubscriptionUser, { ...props, context: { url: 'test' } })],
      })
    );
    expect(client.executeSubscription).toBeCalledWith(
      {
        key: expect.any(Number),
        query: expect.any(Object),
        variables: {},
      },
      {
        url: 'test',
      }
    );
  });

  describe('on subscription', () => {
    it('forwards client response', () => {
      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props })],
        })
      );
      expect(state).toEqual({
        ...data,
        extensions: undefined,
        fetching: true,
        stale: false,
      });
    });
  });

  it('calls handler', () => {
    const handler = jest.fn();

    render(
      h(Provider, {
        value: client as any,
        children: [h(SubscriptionUser, { ...props, handler: () => handler })],
      })
    );

    expect(handler).toBeCalledWith(undefined, 1234);
    expect(handler).toBeCalledTimes(1);
  });

  describe('active teardown', () => {
    it('sets fetching to false when the source ends', () => {
      client.executeSubscription.mockReturnValueOnce(empty);
      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props })],
        })
      );
      expect(client.executeSubscription).toHaveBeenCalled();
      expect(state).toMatchObject({ fetching: false });
    });
  });

  describe('execute subscription', () => {
    it('triggers subscription execution', () => {
      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props })],
        })
      );
      execute();
      expect(client.executeSubscription).toBeCalledTimes(2);
    });
  });

  describe('pause', () => {
    const props = { q: query };

    it('skips executing the query if pause is true', () => {
      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props, pause: true })],
        })
      );
      expect(client.executeSubscription).not.toBeCalled();
    });

    it('skips executing queries if pause updates to true', () => {
      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props })],
        })
      );

      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props })],
        })
      );

      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props, pause: true })],
        })
      );
      render(
        h(Provider, {
          value: client as any,
          children: [h(SubscriptionUser, { ...props, pause: true })],
        })
      );
      expect(client.executeSubscription).toBeCalledTimes(2);
      expect(state).toMatchObject({ fetching: false });
    });
  });
});
