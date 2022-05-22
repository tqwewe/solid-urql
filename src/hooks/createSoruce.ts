/* eslint-disable react-hooks/exhaustive-deps */

import { createEffect, untrack, on } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Source, fromValue, makeSubject, pipe, concat, subscribe } from 'wonka';

type Updater<T> = (input: T) => void;

let currentInit = false;

const isShallowDifferent = (a: any, b: any) => {
  if (typeof a != 'object' || typeof b != 'object') return a !== b;
  for (const x in a) if (!(x in b)) return true;
  for (const x in b) if (a[x] !== b[x]) return true;
  return false;
};

export function createSource<T, R>(
  input: T,
  transform: (input$: Source<T>, initial?: R) => Source<R>
): [R, Updater<T>] {
  const createInputs = (): [Source<T>, (value: T) => void] => {
    const subject = makeSubject<T>();
    const source = concat([fromValue(input), subject.source]);

    const updateInput = (nextInput: T) => {
      if (nextInput !== input) subject.next((input = nextInput));
    };

    return [source, updateInput];
  };

  const [input$, updateInput] = createInputs();

  let store = () => {
    currentInit = true;
    let state: R;
    try {
      pipe(
        transform(fromValue(input)),
        subscribe(value => {
          state = value;
        })
      ).unsubscribe;
    } finally {
      currentInit = false;
    }

    return state!;
  }
  const [state, setState] = createStore<R>(store());

  createEffect(() => {
    return pipe(
      transform(input$, untrack<R>(() => state)),
      subscribe(value => {
        if (!currentInit) {
          setState(prevValue => {
            return isShallowDifferent(prevValue, value) ? value : prevValue;
          });
        }
      })
    ).unsubscribe;
  });
  return [state, updateInput];
}
