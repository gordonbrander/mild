# Mild

A tiny web framework with mild ambitions. One file. No dependencies. No build step.

I don't want to spend 3 hours fiddling with JavaScript bundlers and build tools. It's 2023. The web platform is robust, JavaScript is a pretty good dynamic language, and modules exist. I want to `<script type="module" src="main.js">`, and hit refresh to see changes.

Mild is a little library for just building web apps. You can use it to build a small SPA, or to build deterministic stand-alone components for an island architecture.

## Installing

```html
<script type="module" src="mild.js">
```

That's it.

## A quick example

Here's a simple app that increments a counter whenever you click a button.

```js
import {
  Store,
  next,
  view,
  h,
  $,
  prop
} from '../../mild.js'

// All state changes are expressed in terms of actions sent to a store
const action = {}
action.increment = {type: 'increment'}

// A view describes how to create and update (render) an element.
const appView = view({
  create: (state, send) => h(
    'div',
    {className: 'container'},
    h(
      'div',
      {className: 'text'}
    ),
    h(
      'button',
      {
        className: 'button',
        onclick: event => send(action.increment)
      },
      'Click to increment'
    )
  ),
  render: (containerEl, state, send) => {
    let textEl = $(containerEl, '.text')
    prop(textEl, 'innerText', state.count)
  }
})

const appModel = ({count}) => ({count})

// Create initial state transaction
const init = () => next(appModel({count: 0}))

// Given previous state and an action, creates new state transactions.
const update = (state, action) => {
  switch (action.type) {
  case 'increment':
    return next(appModel({...state, count: state.count + 1}))
  default:
    console.warn("Unhandled action type", action)
    return next(state)
  }
}

// Initialize store
let store = new Store({
  host: document.querySelector('body'),
  view: appView,
  init,
  update
})
```

## `view()`

Mild views are described with two functions, one to create the element, and the other to update it. Like this:

```js
const heading = view({
  create: state => {
    let el = document.createElement('h1')
    el.id = state.id
    el.className = 'heading'
    return el
  },
  render: (el, state) => {
    el.innerText = state.text
  }
})
```

`view()` decorates these functions, so:

- `view.create()` - creates and immediately renders the element
- `view.render()` - writes to the element, but only if state has actually changed (as determined by strict value equality)

```js
// Create an element
let el = heading.create({text: 'Hello World'})

// Update it
let state = {text: 'Goodbye'}
heading.render(el, state)

// Render only writes to the DOM when something changes.
// Calling render multiple times with same state is a no-op.
heading.render(el, state)
heading.render(el, state)
heading.render(el, state)
```

You can call `view.render()` as often as you like. It will only write to the DOM when something has actually changed.

It turns out that hand-crafting your DOM-patching logic like this is very efficient. Unlike a virtual dom, the program doesn't have to do diffing, since you tell it exactly what to update. And while it occasionally requires a little bit more code, it gives you direct access to all platform features, and control over granular updates.

## Store

Mild has a `Store` class that is inspired by the Elm App Architecture.

- State is immutable, and centralized in a single store.
- State is updated via actions sent to the store.
- All state updates are defined through an update function that produces the next state, plus any asynchronous side-effects, such as HTTP requests.

```js
let store = new Store({host, view, init, update})
```

Store takes a configuration object with the following keys:

- `host` - an element on which to mount the root view.
- `view` - a view (an object with `create()` and `render()` functions)
- `init()` - a function that returns an initial state transaction
- `update(state, action)` - a function that receives the current state, and an action, and returns a transaction for the next state

To send messages to the store you can use the `Store.send()` method. Store also sends a `send()` function down to view creation and rendering functions. This is often used to bind to event listeners and send messages up to the store.

```
store.send({type: 'notify', message: 'Hello world'})
```

Both `init()` and `update()` return a _transaction_, which is an object containing the next state and an array of "effects" (promises for more actions).

```
{
  state: State,
  effects: [Promise<Action>]
}
```

You can create a transaction with `next(state)`, or `next(state, [...effects])` if you want to provide promises for additional side-effects.

Each promise in the effects array represents some asynchronous side-effect, such as an HTTP request, or database call. The easiest way to produce promises for effects is with async functions. Call the async function, get the promise, add it to the array of effects. When the promise resolves, the resulting action will `send()` to the store, initiating another update.
