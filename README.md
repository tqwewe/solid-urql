<h1 align="center">Solid URQL</h1>

<div align="center">
  URQL support for Solid JS projects.
</div>

<br>

## Installation

```bash
yarn add solid-urql @urql/core graphql
# or
npm i solid-urql @urql/core graphql
```

## Usage

```tsx
import { createClient, Provider } from 'solid-urql'

const client = createClient({
  url: 'http://localhost:8000/graphql',
})

const App = (props) => {
  return (
    <Provider value={client}>
      <TodoList />
    </Provider>
  )
}
```

```tsx
import { Show } from 'solid-js'
import { createQuery } from 'solid-urql'

const TodosQuery = `
  query {
    todos {
      id
      title
    }
  }
`

const TodoList = (props) => {
  const [items, itemsState, reexecuteQuery] = createQuery({
    query: TodosQuery,
  })

  return (
    <Show when={!itemsState().fetching} fallback={<p>Loading...</p>}>
      <p>
        Items are:{' '}
        {items()
          .map((item) => item.title)
          .join(', ')}
      </p>
    </Show>
  )
}
```

Read more at the [URQL Official Documentation](https://formidable.com/open-source/urql/).

## Contributing 🙌

Contributions are more than welcome. If you see any changes fit, go ahead and open an issue or PR.

---

Any support is a huge motivation, thank you very much!

<a href="https://www.buymeacoffee.com/ariseyhun" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" alt="Buy Me A Coffee" height="32" width="140"></a>
