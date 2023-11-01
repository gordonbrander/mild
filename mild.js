// @ts-check

/**
 * Effect - a promise for an Action, or just an Action.
 * Effects are used to model asynchronous side-effects such as HTTP requests,
 * or timers. They are typically generated by an async function that performs
 * the side effect and returns an action - a message describing what happened.
 * Effects should always return an action, even for failures.
 * @template Action
 * @typedef {Promise<Action>|Action} Effect
 */

/**
 * A send function is a callback to which you can send actions.
 * @template Action
 * @typedef {(action: Action) => void} Send
 */

/**
 * A rendering function. It takes a target, state, and send callback, and
 * performs a mutation on the target to update it with the state. The send
 * callback may be used to send up actions from event listeners.
 * @template {Node} Target
 * @template State
 * @template Action
 * @typedef {(element: Target, state: State, send: Send<Action>) => void} Rendering
 */

/**
 * A view has functions to create and render an element.
 * @template {Node} Target
 * @template State
 * @template Action
 * @typedef {object} View
 * @property {() => Target} create
 * @property {Rendering<Target, State, Action>} render
 */

/**
 * A state transaction containing next state and any effects.
 * We use transaction to model state changes in the store.
 * @template State
 * @template Action
 * @typedef {object} Transaction
 * @property {State} state - the next state
 * @property {Array<Effect<Action>>} effects - effects to send to the store
 */

/**
 * Create a transaction object.
 * A transaction is used to represent a change in state.
 * @template State
 * @template Action
 * @param {State} state - the next state
 * @param {Array<Effect<Action>>} effects - an array of effects producing actions to send to the store.
 * @returns {Transaction<State, Action>}
 */
export const next = (state, effects=[]) => ({state, effects})

/**
 * A promise for the next animation frame.
 * @returns {Promise<number>}
 */
const animationFrame = () => new Promise(requestAnimationFrame)

/**
  * A store who's state is updated via actions.
  * @template {Node} Target
  * @template State
  * @template Action
 */
export class Store {
  #isRenderScheduled = false
  #state
  #target
  #update
  #render

  /**
   * @param {object} options
   * @param {HTMLElement} options.mount - the host element on which to mount the store-managed element
   * @param {() => Target} options.create - the view to render
   * @param {Rendering<Target, State, Action>} options.render - the view to render
   * @param {() => Transaction<State, Action>} options.init - a function to initialize the store
   * @param {(state: State, action: Action) => Transaction<State, Action>} options.update - an update function for producing transactions
   */
  constructor({mount, init, update, create, render}) {
    this.#render = render
    this.#update = update
    let {state, effects} = init()
    this.#state = state
    let target = create()
    this.#target = target
    mount.replaceChildren(target)
    render(target, state, this.send)
    this.runAll(effects)
  }

  /**
   * Send an action to the store
   * This method is instance-bound, so you can safely pass it as a closure.
   * @type Send<Action>
   */
  send = action => {
    console.debug("Action", action)
    let {state, effects} = this.#update(this.#state, action)
    this.#state = state
    console.debug("State", state)
    this.#scheduleRender()
    this.runAll(effects)
  }

  /**
   * Schedule a render on the next animation frame, unless one has already
   * been scheduled.
   */
  async #scheduleRender() {
    if (this.#isRenderScheduled) {
      return
    }
    this.#isRenderScheduled = true
    await animationFrame()
    this.#render(this.#target, this.#state, this.send)
    console.debug("Rendered")
    this.#isRenderScheduled = false
  }

  /**
   * Send an effect to the store
   * @param {Effect<Action>} effect - the effect to send
   */
  async run(effect) {
    let action = await effect
    if (action != null) {
      this.send(action)
    }
  }

  /**
   * Send many effects to the store
   * @param {Array<Effect<Action>>} effects - the effects to send
   */
  async runAll(effects) {
    for (let effect of effects) {
      this.run(effect)
    }
  }
}

const freeze = Object.freeze

/**
 * Create a model - a factory for frozen (shallowly immutable) objects.
 * @template Options
 * @template State
 * @param {(options: Options) => State} create - a function to create model
 * @returns {(options: Options) => State}
 */
export const model = create => options => freeze(create(options))

/**
 * Create a higher-level tagging function that will map an effect.
 * @template Action
 * @template TaggedAction
 * @param {(action: Action) => TaggedAction} tag - a tagging function for an action
 * @returns {(effect: Effect<Action>) => Effect<TaggedAction>}
 */
export const taggingEffect = tag => async (effect) => {
  let action = await effect
  return tag(action)
}

/**
 * Create an update function that acts as a cursor into a subcomponent's state.
 * Resulting function takes a child action, updates the child state within
 * the parent state, tags the child effects as parent effects, and returns
 * a parent transaction.
 * @template State
 * @template Action
 * @template ChildState
 * @template ChildAction
 * @param {object} options - cursor definition
 * @param {(state: ChildState, action: ChildAction) => Transaction<ChildState, ChildAction>} options.update - the child update function
 * @param {(state: State) => ChildState} options.get - a function to get the child state
 * @param {(state: State, child: ChildState) => State} options.put - a function to wrap ta child state within a parent state
 * @param {(action: ChildAction) => Action} options.tag - a function to map child actions into parent actions
 * @returns {(state: State, action: ChildAction) => Transaction<State, Action>}
 */
export const cursor = ({
  update,
  get,
  put,
  tag
}) => (parent, action) => {
  let {state, effects} = update(get(parent), action)
  return next(
    put(parent, state),
    effects.map(taggingEffect(tag))
  )
}

/**
 * @template State
 * @template Action
 * @param {State} state
 * @param {Action} action
 * @returns {Transaction<State, Action>}
 */
export const unknown = (state, action) => {
  console.warn("Unknown action type", action)
  return next(state)
}

/**
 * Forward messages sent to a send function.
 * Creates a new send function that tags actions before sending them.
 * @template Action
 * @template ChildAction
 * @param {Send<Action>} send - a send function to forward messages to
 * @param {(action: ChildAction) => Action} tag - a function that maps child actions to actions
 * @returns {Send<ChildAction>}
 */
export const forward = (send, tag) => action => {
  send(tag(action))
}

/**
 * Create a rendering function that only renders when state actually changes.
 * Change is determined by equality against previously written state.
 * @template {Node} Target
 * @template State
 * @template Action
 * @param {Rendering<Target, State, Action>} render - a rendering
 *   function to be run every time state changes. State change is determined
 *   by strict value equality. If passing an object for states, you should
 *   create a new state object for every update (immutable style).
 * @returns {Rendering<Target, State, Action>} a decorated rendering function
 *   that will run setup once, and run render only when state has changed.
 */
export const rendering = render => {
  // Create a unique symbol for caching state
  // Each renderer gets its own symbol, allowing for multiple renderers
  // to be applied to the same element.
  const _state = Symbol('state')
  /** @type Rendering<Target, State, Action> */
  return (element, state, send) => {
    let prev = element[_state]
    if (prev !== state) {
      render(element, state, send)
      element[_state] = state
    }
  }
}

/**
 * Transform an element factory function into a function that deep clones the
 * element.
 * @template {Node} Target
 * @param {() => Target} factory
 * @returns {() => Target}
 */
export const cloning = factory => {
  let element = factory()
  // @ts-ignore
  return () => element.cloneNode(true)
}

/**
 * Create a view
 * @template State
 * @template Action
 * @template {Node} Target
 * @param {object} options
 * @param {string} options.tag - the HTML tag to create for this view. Div by default.
 * @param {() => Target} options.create - a function to scaffold the element and its children.
 * @param {Rendering<Target, State, Action>} options.render - the render function. Called whenever state changes.
 * @returns {View<Target, State, Action>} the decorated view
 */
export const view = ({
  create,
  render
}) => ({
  create: cloning(create),
  render: rendering(render)
})

/**
 * Create and render a view in one go.
 * @template {Node} Target
 * @template State
 * @template Action
 * @param {View<Target, State, Action>} view
 * @param {State} state
 * @param {(Action) => void} send
 * @returns {Target}
 */
export const create = ({create, render}, state, send) => {
  let element = create()
  render(element, state, send)
  return element
}

/**
 * Insert element at index.
 * If element is already at index, this function is a no-op
 * (it doesn't remove-and-then-add element). By avoiding moving the element
 * unless needed, we preserve focus and selection state for elements that
 * don't move.
 * @param {HTMLElement} parent - the parent element to insert child into
 * @param {HTMLElement} element - the child element to insert
 * @param {number} index - the index at which to insert element
 */
export const insertElementAt = (parent, element, index) => {
  let elementAtIndex = parent.children[index]
  if (elementAtIndex === element) {
    return
  }
  parent.insertBefore(element, elementAtIndex)
}

/**
 * Get the id property from an object
 * @param {object} object
 * @returns {*} the ID property
 */
export const getId = object => object.id

/**
 * An ID tagging function that doesn't do any tagging... it just returns the
 * action unchanged. This is the default tagging function for `item()`.
 * Note: we type state and send as `any` because JSDoc TS fails to infer
 * types of generic functions when used in default arguments. These any types
 * are inferred to be specific State and Action types at the call site.
 * @param {string} id - the id of the item
 * @returns {(action: *) => *}
 */
const noTagging = id => action => action

/**
 * A special view with extra functions for identifying and tagging actions
 * within dynamic lists.
 * @template {Node} Target
 * @template State
 * @template Action
 * @template TaggedAction
 * @typedef {View<Target, State, Action> & {id: (state: State) => string, tagging: (id: string) => (action: Action) => TaggedAction}} ItemView
 */

/**
 * Make an ordinary view into an item view suitable for rendering in
 * dynamic lists.
 * @template {Node} Target
 * @template State
 * @template Action
 * @template TaggedAction
 * @param {object} itemlike
 * @param {() => Target} itemlike.create - a creating function
 * @param {Rendering<Target, State, Action>} itemlike.render - a rendering function
 * @param {(state: State) => string} [itemlike.id] - get a unique ID from the state
 * @param {(id: string) => (action: Action) => TaggedAction} [itemlike.tagging] - an ID tagging function
 * @returns {ItemView<Target, State, Action, TaggedAction>}
 */
export const item = ({
  create,
  render,
  id=getId,
  tagging=noTagging
}) => ({
  create,
  render,
  id,
  tagging
})

// Symbol for marking ID on element
const _id = Symbol('id')

/**
 * Create a function that efficiently renders a dynamic list of children,
 * making minimal updates to the DOM.
 * 
 * Note: States MUST have an ID that is unique within the list.
 * IDs are used to efficiently update the DOM.
 * 
 * Elements corresponding to states by ID are are re-used and re-ordered,
 * rather than being recreated.
 * 
 * - If item remains in the same order relative to siblings
 *   (excluding adds and removals), it is rendered efficiently in-place
 *   (focus and selection are preserved).
 * - If item has been re-ordered relative to siblings, it is moved
 *   into its new location. (This will reset focus and selection).
 * @template State
 * @template Action
 * @param {object} itemlike - an itemlike view, which may or may not have an `id()` function. Defaults to reading the id property of states.
 * @param {() => HTMLElement} itemlike.create - a function to create the element
 * @param {Rendering<HTMLElement, State, Action>} itemlike.render - a function to render the element
 * @param {(state: State) => string} [itemlike.id] - a function to get an ID from the state
 * @param {HTMLElement} parent - the parent element to render children to
 * @param {Array<State>} states - an array of states corresponding to children. Each state must have an ID, as defined by `itemlike.id()`. By default, this is `state.id`.
 * @param {Send<Action>} send - an address callback to send messages to
 */
export const list = (
  itemlike,
  parent,
  states,
  send
) => {
  const itemView = item(itemlike)
  let stateMap = new Map()
  for (let state of states) {
    if (itemView.id(state) === null) {
      throw TypeError("State does not have an ID")
    }
    stateMap.set(itemView.id(state), state)
  }

  // Remove children that are no longer part of state
  // Note that we must construct a list of children to remove, since
  // removing in-place would change the live node list and bork iteration.
  let childMap = new Map()
  let removes = []
  for (let child of parent.children) {
    childMap.set(child[_id], child)
    if (!stateMap.has(child[_id])) {
      removes.push(child)
    }
  }

  for (let child of removes) {
    parent.removeChild(child)
  }

  // Add or re-order items as needed.
  for (var i = 0; i < states.length; i++) {
    let state = states[i]
    let child = childMap.get(itemView.id(state))
    let tag = itemView.tagging(itemView.id(state))
    let address = forward(send, tag)
    if (child == null) {
      let child = create(itemView, state, address)
      child[_id] = itemView.id(state)
      insertElementAt(parent, child, i)
    } else {
      insertElementAt(parent, child, i)
      itemView.render(child, state, address)
    }
  }
}

export const h = (
  tag,
  props={},
  ...children
) => {
  let element = document.createElement(tag)

  const {
    styles,
    dataset,
    ...ordinaryProps
  } = props

  for (let [key, value] of Object.entries(styles)) {
    element.style[key] = value
  }

  for (let [key, value] of Object.entries(dataset)) {
    element.dataset[key] = value
  }

  for (let [key, value] of Object.entries(ordinaryProps)) {
    element[key] = value
  }

  for (let child of children) {
    element.append(child)
  }

  return element
}

export const fragment = string => {
  let templateEl = document.createElement('template')
  templateEl.innerHTML = string
  return templateEl.content
}

export const html = string => fragment(string).firstElementChild

export const css = rules => {
  let sheet = new CSSStyleSheet()
  sheet.replaceSync(rules)
  return sheet
}

/**
 * Layout-triggering DOM properties.
 * @see https://gist.github.com/paulirish/5d52fb081b3570c81e3a
 */
const LAYOUT_TRIGGERING_PROPS = new Set(['innerText'])

/**
 * Set object key, but only if value has actually changed.
 * This is useful when setting keys on DOM elements, where setting the same 
 * value twice might trigger an unnecessary reflow or a style recalc.
 * prop caches the written value and only writes the new value if it
 * is different from the last-written value.
 * 
 * In most cases, we can simply read the value of the DOM property itself.
 * However, there are footgun properties such as `innerText` which
 * will trigger reflow if you read from them. In these cases we warn developers.
 * @see https://gist.github.com/paulirish/5d52fb081b3570c81e3a
 *
 * @template Value - a value that corresponds to the property key
 * @param {object} object - the object to set property on
 * @param {string} key - the key
 * @param {Value} value - the value to set
 */
export const prop = (object, key, value) => {
  if (LAYOUT_TRIGGERING_PROPS.has(key)) {
    console.warn(`Checking property value for ${key} triggers layout. Consider writing to this property without using prop().`)
  }

  if (object[key] !== value) {
    object[key] = value
  }
}

/**
 * Set the textContent of an element, but only if it has actually changes.
 * Shortcut for `prop(element, 'textContent', value)`.
 * @param {Node} node - the elemetn to set text on
 * @param {String} value - the value to set
 */
export const text = (node, value) => prop(node, 'textContent', value)

/**
 * Shortcut for scoped `element.querySelector` query
 * @param {HTMLElement} element - the element to scope query to
 * @param {string} selector - CSS selector for query
 * @returns {HTMLElement|null}
 */
export const $ = (element, selector) => element.querySelector(
  `:scope ${selector}`
)

/**
 * The counter that is incremented for `cid()`
 * @type {number}
 */
let _cid = 0

/**
 * Get an auto-incrementing client-side ID value.
 * IDs are NOT guaranteed to be stable across page refreshes.
 * @returns {string} a client ID string that is unique for the session.
 */
export const cid = () => {
  _cid = _cid + 1
  return `cid${_cid}`
}