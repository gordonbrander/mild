import {
  Store,
  next,
  view,
  mounting,
  $
} from '../../mild.js'

// All state changes are expressed in terms of actions sent to a store
const action = {}
action.increment = {type: 'increment'}

// A view describes how to create and update (render) an element.
const appView = view({
  setup: (el, state, send) => {
    el.className = 'container'
    let textEl = document.createElement('div')
    textEl.className = 'text'
    el.append(textEl)

    let buttonEl = document.createElement('button')
    buttonEl.className = 'text'
    buttonEl.onclick = event => send(action.increment)
    buttonEl.textContent = 'Click to increment'
    el.append(buttonEl)
  },
  render: (el, state, send) => {
    let textEl = $(el, '.text')
    textEl.textContent = state.count
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

let body = $(document, 'body')

// Initialize store
let store = new Store({
  target: body,
  render: mounting(appView),
  init,
  update
})