// @ts-check

/**
 * Create an animation frame queuing function.
 * Queues callback to run with pending animation frame.
 * Unlike `requestAnimationFrame()`, this method will allow you to join
 * the current animation frame while the animation frame is executing, instead
 * of scheduling with the next frame. Useful for nested renders that should
 * execute in the same frame.
 * @returns {(onFrame: () => void) => void}
 */
export const animationQueue = () => {
  const queue = new Set()
  let isFrameScheduled = false

  const transact = () => {
    for (let fn of queue) {
      fn()
    }
    queue.clear()
    isFrameScheduled = false
  }

  const withAnimationFrame = callback => {
    if (!isFrameScheduled) {
      requestAnimationFrame(transact)
      isFrameScheduled = true
    }
    queue.add(callback)
  }

  return withAnimationFrame
}

/**
 * Queues callback to run with pending animation frame.
 * Unlike `requestAnimationFrame()`, this method will allow you to join
 * the current animation frame while the animation frame is executing, instead
 * of scheduling with the next frame. Useful for nested renders that should
 * execute in the same frame.
 */
const withAnimationFrame = animationQueue()

/**
 * Symbol for last rendered state
 */
const __state__ = Symbol('state')

/**
 * Call render on an object within the next frame.
 * @template State
 * @template Msg
 * @param {object} object - the object to render
 * @param {State} state - the state
 * @param {(msg: Msg) => void} send - the address to send messages up to
 * @returns {void}
 */
export const render = (object, state, send) => withAnimationFrame(() => {
  if (object[__state__] !== state) {
    object.render(state, send)
    object[__state__] = state
  }
})

/**
 * Create a view and schedule a render on it
 * @template View
 * @template State
 * @template Msg
 * @param {() => View} view 
 * @param {State} state 
 * @param {(msg: Msg) => void} send 
 * @returns {View}
 */
export const create = (view, state, send) => {
  const element = view()
  render(element, state, send)
  return element
}

/**
 * Effect - a promise for an Msg, or just an Msg.
 * Effects are used to model asynchronous side-effects such as HTTP requests,
 * or timers. They are typically generated by an async function that performs
 * the side effect and returns an action - a message describing what happened.
 * Effects should always return an action, even for failures.
 * @template Msg
 * @typedef {Promise<Msg>|Msg} Effect
 */

/**
 * A state transaction containing next state and any effects.
 * We use transaction to model state changes in the store.
 * @template State
 * @template Msg
 * @typedef {object} Transaction
 * @property {State} state - the next state
 * @property {Array<Effect<Msg>>} effects - effects to send to the store
 */

/**
 * Create a transaction object.
 * A transaction is used to represent a change in state.
 * @template State
 * @template Msg
 * @param {State} state - the next state
 * @param {Array<Effect<Msg>>} effects - an array of effects producing actions to send to the store.
 * @returns {Transaction<State, Msg>}
 */
export const next = (state, effects=[]) => ({state, effects})

/**
 * Create a store of state that calls render whenever state changes.
 * @template State
 * @template Msg
 * @param {object} config
 * @param {HTMLElement} config.target - the target to render to
 * @param {() => Transaction<State, Msg>} config.init
 * @param {(state: State, msg: Msg) => Transaction<State, Msg>} config.update
 * @param {boolean} config.debug - log debug messages?
 * @returns {(msg: Msg) => void} send function
 */
export const useStore = ({
  target,
  init,
  update,
  debug=false
}) => {
  const {state: initial, effects} = init()
  let state = initial

  const send = msg => {
    const next = update(state, msg)
    if (debug) {
      console.debug('store.msg', msg)
      console.debug('store.effects', next.effects.length)
    }
    if (state !== next.state) {
      state = next.state
      if (debug) {
        console.debug('store.state', next.state)
      }
      render(target, state, send)
    }
  }

  const runEffect = async (effect) => {
    const value = await effect
    if (value != null) {
      send(value)
    }
  }

  const runEffects = effects => effects.forEach(runEffect)

  render(target, state, send)

  return send
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
 * @template Msg
 * @template TaggedMsg
 * @param {(action: Msg) => TaggedMsg} tag - a tagging function for an action
 * @returns {(effect: Effect<Msg>) => Effect<TaggedMsg>}
 */
export const taggingEffect = tag => async (effect) => {
  const action = await effect
  return tag(action)
}

/**
 * Create an update function that acts as a cursor into a subcomponent's state.
 * Resulting function takes a child action, updates the child state within
 * the parent state, tags the child effects as parent effects, and returns
 * a parent transaction.
 * @template State
 * @template Msg
 * @template ChildState
 * @template ChildMsg
 * @param {object} options - cursor definition
 * @param {(state: ChildState, action: ChildMsg) => Transaction<ChildState, ChildMsg>} options.update - the child update function
 * @param {(state: State) => ChildState} options.get - a function to get the child state
 * @param {(state: State, child: ChildState) => State} options.put - a function to wrap ta child state within a parent state
 * @param {(action: ChildMsg) => Msg} options.tag - a function to map child actions into parent actions
 * @returns {(state: State, action: ChildMsg) => Transaction<State, Msg>}
 */
export const cursor = ({
  update,
  get,
  put,
  tag
}) => (parent, action) => {
  const {state, effects} = update(get(parent), action)
  return next(
    put(parent, state),
    effects.map(taggingEffect(tag))
  )
}

/**
 * @template State
 * @template Msg
 * @param {State} state
 * @param {Msg} action
 * @returns {Transaction<State, Msg>}
 */
export const unknown = (state, action) => {
  console.warn("Unknown action type", action)
  return next(state)
}

export const getId = item => item.id

/**
 * Index an array of identified items by key.
 * Since maps are iterated in insertion order, we index once and then
 * have an ordered keyed collection we can do efficient lookups over.
 * Useful for modeling child views.
 * @template Key
 * @template Item
 * @param {Iterable<Item>} items 
 * @param {(item: Item) => Key} getKey 
 * @returns {Map<Key, Item>} the indexed items
 */
export const index = (items, getKey=getId) => {
  const indexedItems = new Map()
  for (const item of items) {
    indexedItems.set(getKey(item), item)
  }
  return indexedItems
}

/**
 * Symbol for list item key
 */
const __key__ = Symbol('list item key')

/**
 * Create a new view-rendering function that will efficiently render
 * a dynamic list of items on a parent view.
 * @template State
 * @template Msg
 * @template Key
 * @param {() => HTMLElement} view a view factory function
 * @param {(state: State) => Key} getKey a function to get a unique key from
 *   the item model.
 * @returns {(parent: HTMLElement, states: Array<State>, send: (msg: Msg) => void) => void}
 */
export const list = (view, getKey=getId) => (parent, states, send) => {
  const stateMap = index(states, getKey)

  // Remove children that are no longer part of state
  // Note that we must construct a list of children to remove, since
  // removing in-place would change the live node list and bork iteration.
  const childMap = new Map()
  const removes = []
  for (const child of parent.children) {
    childMap.set(child[__key__], child)
    if (!stateMap.has(child[__key__])) {
      removes.push(child)
    }
  }

  for (const child of removes) {
    parent.removeChild(child)
  }

  // Add or re-order items as needed.
  for (var i = 0; i < states.length; i++) {
    const state = states[i]
    const key = getKey(state)
    const child = childMap.get(key)
    if (child == null) {
      const child = create(view, state, send)
      child[__key__] = key
      insertElementAt(parent, child, i)
    } else {
      insertElementAt(parent, child, i)
      render(child, state, send)
    }
  }
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
  const elementAtIndex = parent.children[index]
  if (elementAtIndex === element) {
    return
  }
  parent.insertBefore(element, elementAtIndex)
}

/**
 * Hyperscript-style element builder
 * @param {string} tag - the tag name of the element to create 
 * @param {object} props - element properties to set
 * @param  {...(Node | string)} children - elements or strings to append
 * @returns {HTMLElement}
 */
export const h = (
  tag,
  props={},
  ...children
) => {
  const element = document.createElement(tag)

  const {
    styles={},
    dataset={},
    ...ordinaryProps
  } = props

  for (const [key, value] of Object.entries(styles)) {
    element.style[key] = value
  }

  for (const [key, value] of Object.entries(dataset)) {
    element.dataset[key] = value
  }

  for (const [key, value] of Object.entries(ordinaryProps)) {
    element[key] = value
  }

  for (const child of children) {
    element.append(child)
  }

  return element
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
 * The counter that is incremented for `cid()`
 * @type {number}
 */
let _cid = 0

/**
 * Get an auto-incrementing client-side ID value.
 * IDs are NOT guaranteed to be stable across page refreshes.
 * @returns {string} a client ID string that is unique for the session.
 */
export const cid = () => `cid${_cid++}`