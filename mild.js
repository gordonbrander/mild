const frame = async () =>
  new Promise(resolve => requestAnimationFrame(resolve))

const noop = () => {}

// A store that schedules a write when a state change happens.
// 
// Renders are batched, so you get max one write per frame, even
// if state is updated multiple times per frame.
export class Store {
  #isRenderScheduled = false
  #target
  #state

  constructor(target, {
    flags=noop,
    init,
    update,
    render,
    onEvent=noop,
    debug=false
  }) {
    this.#target = target
    this.update = update
    this.render = render
    this.onEvent = onEvent
    this.debug = debug
    const [next, fx] = init(flags(target))
    this.#state = next
    this.#render()
    this.perform(fx)
  }

  async #render() {
    if (this.#isRenderScheduled) {
      return
    }
    this.#isRenderScheduled = true
    await frame()
    this.render(this.#target, this.#state)
    this.#isRenderScheduled = false
  }

  // handleEvent conforms Store to eventhandler interface, allowing you to
  // bind it as an event listener.
  handleEvent(event) {
    const msg = this.onEvent(event)
    if (msg != null) {
      this.send(msg)
    }
  }

  async perform(fx) {
    const msg = await fx
    if (msg != null) {
      this.send(msg)
    }
  }

  shouldRender(prev, next) {
    return prev !== next
  }

  send(msg) {
    let [state, fx] = this.update(this.#state, msg)
    if (this.debug) {
      console.debug(">> msg", msg)
      console.debug("<< state", state)
    }
    if (this.shouldRender(this.#state, state)) {
      this.#state = state
      this.#render()
    }
    this.perform(fx)
  }
}

// Create an update function for a small part of a state.
export const cursor = ({get, put, update}) => (big, msg) => {
  const small = get(big)
  if (small == null) {
    return big
  }
  const next = update(small, msg)
  if (next === small) {
    return big
  }
  return put(big, next)
}

export const template = string => {
  let templateEl = document.createElement('template')
  templateEl.innerHTML = string
  return templateEl
}

// An element that knows how to scaffold its shadow dom from a static template.
// Template is cached using `Fragment` for efficient cloning.
export class ViewElement extends HTMLElement {
  // Static HTML template used to generate skeleton with which to
  // populate shadow DOM.
  static template = template('<div>Hello world</div>')

  static render(target, state) {
    target.render(state)
  }

  #state

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    const fragment = this.constructor.template.content.cloneNode(true)
    this.shadowRoot.append(fragment)
  }

  render(state) {
    if (this.#state !== state) {
      this.write(state)
      this.#state = state
    }
  }

  write(state) {}
}

// A stateful element that holds a store.
// Useful for defining a single top-level root element,
// or for defining multiple, in island architectures.
export class ComponentElement extends ViewElement {
  static flags(element) {
    return null
  }

  static init() {}

  static update() {}

  static onEvent(event) {}

  store = new Store(this, this.constructor)
}

export const render = (el, state) => {
  el.render(state)
  return el
}

// Create a writeable element by its tag name, and immediately
// render first state.
export const create = (tag, state) =>
  render(document.createElement(tag), state)

// Render a dynamic list of elements.
// Renders items. Rebuilds list, if list has changed.
//
// Arguments
// tag: the tag name of the child elements
// parent: the parent element
// states: a Map of states, in order they should appear in source
//
// Requirements:
// - States must have an `id` property.
// - Element is assigned an `id` matching state
// - Element must have a `render` method.
export const list = (tag, parent, states) => {
  let items = Array.from(parent.children)
  const shortest = Math.min(items.length, states.length)
  // Update matched pairs of items and states
  for (var i = 0; i < shortest; i++) {
    const item = items[i]
    const state = states[i]
    // Update (or replace if ID doesn't match)
    if (state.id === item.id) {
      render(item, state)
    } else {
      const node = document.createElement(tag)
      // Assign ID first. This is required so that events and write fns can
      // identify element.
      node.id = state.id
      item.replaceWith(node)
      // Render *after* appending to give dom-connected things like focus
      // a chance to happen.
      render(node, state)
    }
  }

  // Remove old elements
  if (items.length > states.length) {
    const removes = items.slice(states.length)
    for (let item of removes) {
      item.remove()
    }
  }
  // Append new elements
  else if (items.length < states.length) {
    const appends = states.slice(items.length)
    for (let state of appends) {
      const node = document.createElement(tag)
      // Assign ID first. This is required so that events and write fns can
      // identify element.
      node.id = state.id
      parent.appendChild(node)
      // Render *after* appending to give dom-connected things like focus
      // a chance to happen.
      render(node, state)
    }
  }
}


// The global auto-incrementing client ID state.
let _cid = 0

// Get an auto-incrementing client-side ID value.
// IDs are NOT guaranteed to be stable across page refreshes.
export const cid = () => {
  _cid = _cid + 1
  return `cid${_cid}`
}