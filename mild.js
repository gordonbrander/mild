// Turn a promise into an effect (continuation passing style side-effect)
export const Fx = promise => send => {
  promise.then(send)
}

// Batch effects
export const BatchFx = effects => send => {
  for (let effect of effects) {
    effect(send)
  }
}

// No effect type
export const NoFx = send => {}

// An effect for just the value
export const JustFx = msg => send => {
  send(msg)
}

// Forward a send function
export const forward = (send, tag) => msg => send(tag(msg))

// Map an effect, transforming it with `tag`, and returning a new effect.
export const MapFx = (fx, tag) => send => {
  fx(forward(send, tag))
}

// Create a state transaction with state and effect.
export const Update = (state, fx=NoFx) => [state, fx]

// A store that shedules an animation frame when a state change happens.
// 
// Renders are batched, so you get max one write per animation frame, even
// if state is updated multiple times per frame.
//
// Returns a `send` function which you can invoke with messages.
// Messages get passed to update, which produces a `Change`.
// Effects of the change will be run, and if the state has changed, a
// render will be scheduled.
export const Store = ({flags=null, init, update, render}) => {
  const send = msg => {
    let [next, fx] = update(state, msg)
    if (state !== next) {
      state = next
      if (!isFrameScheduled) {
        isFrameScheduled = true
        requestAnimationFrame(frame)
      }
    }
    fx(send)
  }

  const frame = () => {
    isFrameScheduled = false
    render(state, send)
  }

  const [next, fx] = init(flags)

  let isFrameScheduled = false
  let state = next
  fx(send)

  // Issue first render next tick
  Promise.resolve().then(frame)

  return send
}

// Create an update function for a small part of a state.
// Maps effects.
export const cursor = ({get, put, tag, update}) => (big, msg) => {
  let small = get(big)
  if (small == null) {
    return change(big)
  }
  let [next, fx] = update(small, msg)
  return Update(
    put(big, next.state),
    MapFx(fx, tag)
  )
}

// Creates a cache of document fragments, memoized by template string.
export const FragmentCache = () => {
  let cache = new Map()

  const clear = () => {
    cache.clear()
  }

  const fragment = string => {
    if (cache.get(string) == null) {
      let templateEl = document.createElement('template')
      templateEl.innerHTML = string
      cache.set(string, templateEl)
    }
    let templateEl = cache.get(string)
    let fragmentEl = templateEl.content.cloneNode(true)
    return fragmentEl
  }

  fragment.clear = clear

  return fragment
}

// Default fragment cache
export const Fragment = FragmentCache()

// A "stateless" view element that is rendered as a function of state.
// Only re-renders when state has changed.
export class ViewElement extends HTMLElement {
  // Static HTML template used to generate skeleton with which to
  // populate shadow DOM.
  static template() { return "" }

  // Last-written state
  #state

  // Set state of element, triggering a write if state changed
  render = (state, send) => {
    if (this.#state !== state) {
      this.#state = state
      this.write(state, send)
    }
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    let fragment = Fragment(this.constructor.template())
    this.shadowRoot.append(fragment)
  }

  // Write this view. Extend and override.
  write(state, send) {}
}

// A stateful element that holds a store.
// Useful for defining a single top-level root element,
// or for defining multiple, in island architectures.
export class ComponentElement extends ViewElement {
  static init() {
    return Update({})
  }

  static update(state, msg) {
    return Update(state)
  }

  send = Store({
    flags: this.flags(),
    init: this.constructor.init,
    update: this.constructor.update,
    render: this.render
  })

  flags() {}

  write(state, send) {}
}

// Create an ID'd item tagging function
export const TagItem = id => value => ({type: 'item', id, value})

const isListMatchingById = (items, states) => {
  if (items.length !== states.length) {
    return false
  }
  for (let i = 0; i < states.length; i++) {
    let item = items[i]
    let state = states[i]
    if (item._id !== state.id) {
      return false
    }
  }
  return true
}

// Render a dynamic list of elements.
// Renders items. Rebuilds list if list has changed.
//
// Arguments
// tag: the tag name of the child elements
// parent: the parent element
// states: an array of states
//
// Requirements:
// - States must have an `id` property.
// - Element must have a `render` method.
export const list = (tag, parent, states, send) => {
  // If all state IDs match all list IDs, just loop through and write.
  // Otherwise, rebuild the list.
  if (isListMatchingById(parent.children, states)) {
    for (let i = 0; i < states.length; i++) {
      let item = parent.children[i]
      let state = states[i]
      item.render(state, forward(send, TagItem(item._id)))
    }
  } else {
    let items = []
    for (let state of states) {
      let item = document.createElement(tag)
      item._id = state.id
      item.render(state, forward(send, TagItem(item._id)))
      items.push(item)
    }
    // Replace any remaining current nodes with the children array we've built.
    parent.replaceChildren(...items)
  }
}

let _cid = 0

// Get an auto-incrementing client-side ID value
// IDs are NOT guaranteed to be stable across page refreshes.
export const cid = () => {
  _cid = _cid + 1
  return _cid
}

export const query = (scope, selector) =>
  scope.querySelector(`:scope ${selector}`)
