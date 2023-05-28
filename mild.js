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

// A store that shedules a write when a state change happens.
// 
// Renders are batched, so you get max one write per frame, even
// if state is updated multiple times per frame.
//
// Returns a `send` function which you can invoke with messages.
// Messages get passed to update, which produces a `Change`.
// Effects of the change will be run, and if the state has changed, a
// render will be scheduled.
export class Store {
  #isRenderScheduled = false
  #state
  #update
  #write

  constructor({flags=null, init, update, write}) {
    this.#update = update
    this.#write = write

    const [next, fx] = init(flags)
    this.#state = next
    fx(this.send)

    this.#render()
  }

  async #render() {
    if (this.#isRenderScheduled) {
      return
    }
    this.#isRenderScheduled = true
    await Promise.resolve()
    this.#write(this.#state, this.send)
    this.#isRenderScheduled = false
  }

  send = msg => {
    let [next, fx] = this.#update(this.#state, msg)
    if (this.#state !== next) {
      this.#state = next
      this.#render()
    }
    fx(this.send)
  }
}

// Create an update function for a small part of a state.
// Maps effects.
export const cursor = ({get, put, tag, update}) => (big, msg) => {
  let small = get(big)
  if (small == null) {
    return Update(big)
  }
  let [next, fx] = update(small, msg)
  return Update(
    put(big, next.state),
    MapFx(fx, tag)
  )
}

// Symbol for last-written element state
const _state = Symbol('state')

// Call a write function with element, state, and send.
// Only writes if state has changed since last write.
// Caches written state at `Symbol(state)` so it can compare states.
export const renders = (write, el, state, send) => {
  if (el[_state] !== state) {
    write(el, state, send)
    el[_state] = state
  }
  return el
}

// Create a rendering function with a write function
export const rendering = write => (el, state, send) =>
  renders(write, el, state, send)

// Render
// A general-purpose rendering function that renders a "writeable" object -
// any object which implements a `.write(state, send)` method.
export const render = rendering((el, state, send) => {
  el.write(state, send)
})

// Create a writeable element by its tag name, and immediately
// render first state.
export const create = (tag, state, send) =>
  render(document.createElement(tag), state, send)

// Creates a cache of document fxragments, memoized by template string.
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

// An element that knows how to scaffold its shadow dom from a static template.
// Template is cached using `Fragment` for efficient cloning.
export class TemplateElement extends HTMLElement {
  // Static HTML template used to generate skeleton with which to
  // populate shadow DOM.
  static template() { return "" }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    let fragment = Fragment(this.constructor.template())
    this.shadowRoot.append(fragment)
  }
}

// A stateful element that holds a store.
// Useful for defining a single top-level root element,
// or for defining multiple, in island architectures.
export class ComponentElement extends TemplateElement {
  static template() {
    throw Error("Not implemented")
  }

  static init() {
    throw Error("Not implemented")
  }

  static update(state, msg) {
    throw Error("Not implemented")
  }

  #write = (state, send) => {
    this.write(state, send)
  }

  #store = new Store({
    flags: this,
    init: this.constructor.init,
    update: this.constructor.update,
    write: this.#write
  })

  send = this.#store.send

  write(state, send) {
    throw Error("Not implemented")
  }
}

// Create an ID'd item tagging function
export const TagItem = id => value => ({type: 'item', id, value})

const isListMatchingById = (items, states) => {
  if (items.length !== states.length) {
    return false
  }
  let _id = Symbol.for('id')
  for (let i = 0; i < states.length; i++) {
    let item = items[i]
    let state = states[i]
    if (item[_id] !== state.id) {
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
  let _id = Symbol.for('id')
  // If all state IDs match all list IDs, just loop through and write.
  // Otherwise, rebuild the list.
  if (isListMatchingById(parent.children, states)) {
    for (let i = 0; i < states.length; i++) {
      let item = parent.children[i]
      let state = states[i]
      render(item, state, forward(send, TagItem(item[_id])))
    }
  } else {
    let items = []
    for (let state of states) {
      let item = create(tag, state, forward(send, TagItem(item[_id])))
      item[_id] = state.id
      items.push(item)
    }
    // Replace any remaining current nodes with the children array we've built.
    parent.replaceChildren(...items)
  }
}

// The global auto-incrementing client ID state.
let _cid = 0

// Get an auto-incrementing client-side ID value
// IDs are NOT guaranteed to be stable across page refreshes.
export const cid = () => {
  _cid = _cid + 1
  return _cid
}

// Query selector within scope.
export const query = (scope, selector) =>
  scope.querySelector(`:scope ${selector}`)

// Shortcut for defining a custom element
const define = (tag, defn) => {
  customElements.define(tag, defn)
  return defn
}