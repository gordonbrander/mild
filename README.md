# Mild

A little web framework with mild ambitions. One file. No dependencies. No build step.

I don't want to spend 3 hours fiddling with JavaScript bundlers and build tools. It's 2023. The web platform is robust, JavaScript is a pretty good dynamic language, and modules exist. I want to `<script type="module" src="main.js">`, and hit refresh to see changes.

You can use Mild to build a small SPA, or to build deterministic stand-alone components in an island architecture.

## Installing

```html
<script type="module" src="mild.js">
```

That's it.

## A quick example

Here's a simple app that increments a counter whenever you click a button.

```js
import {
  useStore,
  next,
  unknown,
  render,
  h
} from './mild.js'

// All state changes are expressed in terms of actions sent to a store
const msg = {}
msg.increment = {type: 'increment'}

// A view is just a function that constructs and returns an element,
// assigning it a `render` method that knows how to update the element.
const viewApp = () => {
  const containerEl = h(
    'div',
    {className: 'container'},
  )
  const textEl = h('div', {className: 'text'})
  containerEl.append(textEl)

  const buttonEl = h('button', {className: 'button'}, 'Click to increment')
  containerEl.append(buttonEl)

  containerEl.render = (state, send) => {
    buttonEl.onclick = () => send(msg.increment)
    textEl.textContent = state.count
  }

  return containerEl
}

const app = ({count}) => ({count})

// Create initial state transaction
const init = () => next(app({count: 0}))

// Given previous state and an action, creates new state transactions.
const update = (state, msg) => {
  switch (msg.type) {
  case 'increment':
    return next(app({...state, count: state.count + 1}))
  default:
    return unknown(state, msg)
  }
}

const appEl = viewApp()
document.body.append(appEl)

// Initialize store
const send = useStore({
  debug: true,
  init,
  update,
  render: (state, send) => render(appEl, state, send)
})
```

## Views

Mild views are just functions that construct an element. Views can define update logic by assigning a `render()` method to the element.

```js
const viewHeading = () => {
  const el = document.createElement('h1')
  el.id = state.id
  el.className = 'heading'

  el.render = (state, send) => {
    el.textContent = state.text
  }

  return el
}
```

Mild offers a top-level function called `render()` that will schedule the element's render function to be called with the next animation frame. Better still, the render method is only run if the new state would actually change the element.

```js
// Create an element.
let el = viewHeading()

// Update it.
let state = {text: 'Goodbye'}
render(el, state)

// Only calls underlying render function when state actually changes.
// Calling render multiple times with same state is a no-op.
render(el, state)
render(el, state)
render(el, state)
```

You can call `render()` as often as you like. It will only write to the DOM when something has actually changed.

Mild also provides helper functions for granular property updates:

```js
// Only sets property when value actually changes.
prop(el, 'hidden', state.isHidden)

// Only sets text when value actually changes.
text(el, state.text)
```

It turns out that hand-crafting your DOM-patching logic like this is very efficient. Unlike a virtual dom, the program doesn't have to do diffing, since you tell it exactly what to update. And while it occasionally requires a little bit more code, it gives you direct access to all platform features, and control over granular updates.

## Store

Mild has a store that is inspired by the Elm App Architecture.

- State is immutable, and centralized in a single store.
- State is updated via actions sent to the store.
- All state updates are defined through an update function that produces the next state, plus any asynchronous side-effects, such as HTTP requests.

```js
const appEl = viewApp()
document.body.append(appEl)

const send = useStore({init, update, target: appEl})

send({type: 'notify', message: 'Hello world'})
```

Store takes a configuration object with the following keys:

- `init()` - a function that returns an initial state transaction
- `update(state, action)` - a function that receives the current state, and an action, and returns a transaction for the next state
- `target` - an element to render to (must implement a `render(state, send)` method)

To send messages to the store you can use the returned `send(msg)` method. Store also sends a `send()` function down to the rendering functions. This can be used to bind to event listeners and send messages up to the store.

Both `init()` and `update()` return a _transaction_, which is an object containing the next state and an array of "effects" (promises for more actions).

```
{
  state: State,
  effects: [Promise<Action>]
}
```

You can create a transaction with `next(state)`, or `next(state, [...effects])` if you want to provide promises for additional side-effects.

Each promise in the effects array represents some asynchronous side-effect, such as an HTTP request, or database call. The easiest way to produce promises for effects is with async functions. Call the async function, get the promise, add it to the array of effects. When the promise resolves, the resulting action will `send()` to the store, initiating another update.