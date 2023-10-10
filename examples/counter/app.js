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
        onclick: event => {
          send(action.increment)
        }
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