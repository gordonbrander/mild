// @ts-check

/**
 * Effect - a promise for an Action, or just an Action.
 * @template Action
 * @typedef {Promise<Action>|Action} Effect
 */

/**
 * A state transaction containing next state and any effects.
 * @template State
 * @template Action
 * @typedef {object} Transaction
 * @property {State} state - the next state
 * @property {Array<Effect<Action>>} effects - effects to send to the store
 */

/**
 * A send function is a callback to which you can send messages
 * @template Action
 * @typedef {(action: Action) => void} Send
 */

/**
 * An element-creating factory function
 * @template State
 * @template Action
 * @typedef {(state: State, send: Send<Action>) => HTMLElement} Creating
 */

/**
 * A rendering function
 * @template State
 * @template Action
 * @typedef {(element: HTMLElement, state: State, send: Send<Action>) => void} Rendering
 */

/**
 * A view has functions to create and render an element.
 * @template State
 * @template Action
 * @typedef {object} View
 * @property {Creating<State, Action>} create
 * @property {Rendering<State, Action>} render
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
 * An initialization function that produces an initial state transaction.
 * @template State
 * @template Action
 * @typedef {() => Transaction<State, Action>} Init
 */

/**
 * An update function that produces a new state transaction
 * given a previous state and action.
 * @template State
 * @template Action
 * @typedef {(state: State, action: Action) => Transaction<State, Action>} Update
 */

/**
  * A store who's state is updated via actions.
  * @template State
  * @template Action
 */
export class Store {
  #isRenderScheduled = false
  #state
  #update
  #target
  #render

  /**
   * @param {object} options
   * @param {HTMLElement} options.host - the host element on which to mount the store-managed element
   * @param {View<State, Action>} options.view - the view to render
   * @param {Init<State, Action>} options.init - a function to initialize the store
   * @param {Update<State, Action>} options.update - an update function for producing transactions
   */
  constructor({host, view, init, update}) {
    let {create, render} = view
    this.#render = render
    this.#update = update
    let {state, effects} = init()
    this.#state = state
    this.#target = create(this.#state, this.send)
    host.append(this.#target)
    this.runAll(effects)
  }

  /**
   * Send an action to the store
   * @param {Action} action - the action to send
   */
  send = action => {
    console.debug("Action", action)
    let {state, effects} = this.#update(this.#state, action)
    this.#state = state
    console.debug("State", state)
    this.#scheduleRender()
    this.runAll(effects)
  }

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
 * @template State
 * @template Action
 * @param {Rendering<State, Action>} render - rendering function to decorate.
 * @returns {Rendering<State, Action>} the decorated rendering function.
 */
export const rendering = render => {
  // Create a unique symbol for caching state
  // Each renderer gets its own symbol, allowing for multiple renderers
  // to be applied to the same element.
  const _state = Symbol('state')

  /** @type Rendering<State, Action> */
  const renderWhenChanged = (element, state, send) => {
    let prev = element[_state]
    if (prev !== state) {
      render(element, state, send)
      element[_state] = state
    }
  }

  return renderWhenChanged
}

/**
 * Decorate a basic view so that
 * - Its rendering function only renders when state changes
 * - Its create function automatically renders while creating
 * @template State
 * @template Action
 * @param {View<State, Action>} view - view to decorate
 * @returns {View<State, Action>} the decorated view
 */
export const view = ({create, render}) => {
  // Create and immediately render element.
  const createAndRender = (state, send) => {
    let el = create(state, send)
    renderWhenChanged(el, state, send)
    return el
  }

  const renderWhenChanged = rendering(render)

  return {create: createAndRender, render: renderWhenChanged}
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
 * @template Action
 * @typedef {object} ItemAction
 * @property {string} type - the action type ("item")
 * @property {string} id - the ID of the item
 * @property {Action} action - the action to wrap
 */

/**
 * Get the id property from an object
 * @param {object} object
 * @returns {*} the ID property
 */
export const getId = object => object.id

/**
 * An ID tagging function that doesn't do any tagging... it just returns the
 * action unchanged. This is the default tagging function for `item()`.
 * @template Action
 * @param {string} id - the id of the item
 * @returns {(action: Action) => Action}
 */
const noTagging = id => action => action

/**
 * A special view with extra functions for identifying and tagging actions
 * within dynamic lists.
 * @template ItemState
 * @template ItemAction
 * @template Action
 * @typedef {View<ItemState, ItemAction> & {id: (state: ItemState) => string, tagging: (id: string) => (action: Action) => ItemAction}} ItemView
 */

/**
 * Make an ordinary view into an item view suitable for rendering in
 * dynamic lists.
 *
 * @template ItemState
 * @template ItemAction
 * @template Action
 * @param {object} itemlike
 * @param {Creating<ItemState, ItemAction>} itemlike.create - a creating function
 * @param {Rendering<ItemState, ItemAction>} itemlike.render - a rendering function
 * @param {(state: ItemState) => string} [itemlike.id] - get a unique ID from the state
 * @param {(id: string) => (action: ItemAction) => Action} [itemlike.tagging] - an ID tagging function
 * @returns {ItemView<ItemState, ItemAction, Action>}
 */
export const item = ({
  create,
  render,
  id=getId,
  // TS seems unable to infer that `ItemAction` is `Action`
  // @ts-ignore
  tagging=noTagging
}) => ({
  create,
  render,
  id,
  // TS seems unable to infer that `ItemAction` is `Action`
  // @ts-ignore
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
 * @param {Creating<State, Action>} itemlike.create - a function to create the element
 * @param {Rendering<State, Action>} itemlike.render - a function to render the element
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
  const {create, render, id, tagging} = item(itemlike)
  let stateMap = new Map()
  for (let state of states) {
    if (id(state) === null) {
      throw TypeError("State does not have an ID")
    }
    stateMap.set(id(state), state)
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
    let child = childMap.get(id(state))
    let tag = tagging(id(state))
    let address = forward(send, tag)
    if (child == null) {
      let child = create(state, address)
      child[_id] = id(state)
      insertElementAt(parent, child, i)
    } else {
      insertElementAt(parent, child, i)
      render(child, state, address)
    }
  }
}

/**
 * Decorate a create function so that it caches and deep-clones
 * the returned element.
 * @param {() => HTMLElement} create - an element factory function
 * @returns HTMLElement
 */
export const cloning = create => {
  let element = create()
  return () => element.cloneNode(true)
}

/**
 * Set key on object, but only if value has changed.
 * This is useful when setting keys on DOM elements, where setting the same 
 * value might trigger a style recalc.
 * 
 * Note that the typical layout-triggering DOM properties are read-only,
 * so this is safe to use to write to DOM element properties.
 * See https://gist.github.com/paulirish/5d52fb081b3570c81e3a.
 *
 * @template Value - a value that corresponds to the property key
 * @param {object} object - the object to set property on
 * @param {string} key - the key
 * @param {Value} value - the value to set
 */
export const prop = (object, key, value) => {
  if (object[key] !== value) {
    object[key] = value
  }
}

/**
 * Set keys on object, avoiding mutation when value is the same.
 * Useful for setting multiple properties on an element while avoiding mutation.
 *
 * @param {HTMLElement} element - the object to set property on
 * @param {object} props - an object representing the properties to change
 */
export const props = (element, props) => {
  // Pluck out style and dataset for special handling.
  // style and dataset are structured values that cannot be directly set as
  // props. We destructure them so we can set them key-by-key.
  let {
    style={},
    dataset={},
    ...ordinaryProps
  } = props

  // Set styles
  for (let [key, value] of Object.entries(style)) {
    prop(element.style, key, value)
  }

  // Set data
  for (let [key, value] of Object.entries(dataset)) {
    prop(element.dataset, key, value)
  }

  // Set remaining properties
  for (let [key, value] of Object.entries(ordinaryProps)) {
    prop(element, key, value)
  }
}

/**
 * Hyperscript-style element builder.
 * @param {string} tag - the tag of the HTML element to create
 * @param {object} properties - an object representing the properties to set
 * @param {...(HTMLElement|string)} children - children to append
 */
export const h = (tag, properties, ...children) => {
  /** @type HTMLElement */
  let element = document.createElement(tag)
  props(element, properties)
  element.replaceChildren(...children)
  return element
}

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