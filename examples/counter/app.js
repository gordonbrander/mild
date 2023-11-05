import {
  Store,
  next,
  view,
  $,
  h
} from '../../mild.js'

// All state changes are expressed in terms of actions sent to a store
const action = {}
action.increment = {type: 'increment'}

// A view describes how to create and update (render) an element.
const app = view({
  create: () => h(
    'div',
    {className: 'container'},
    h('div', {className: 'text'}),
    h('button', {className: 'button'}, 'Click to increment')
  ),
  render: (el, state, send) => {
    let buttonEl = $(el, '.button')
    buttonEl.onclick = event => send(action.increment)

    let textEl = $(el, '.text')
    textEl.textContent = state.count
  }
})

app.model = ({count}) => ({count})

// Create initial state transaction
app.init = () => next(app.model({count: 0}))

// Given previous state and an action, creates new state transactions.
app.update = (state, action) => {
  switch (action.type) {
  case 'increment':
    return next(app.model({...state, count: state.count + 1}))
  default:
    console.warn("Unhandled action type", action)
    return next(state)
  }
}

let body = $(document, 'body')

// Initialize store
let store = new Store({
  mount: body,
  ...app
})