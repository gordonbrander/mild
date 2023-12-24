import {
  useStore,
  next,
  unknown,
  render,
  h
} from '../../mild.js'

// All state changes are expressed in terms of actions sent to a store
const msg = {}
msg.increment = {type: 'increment'}

// A view describes how to create and update (render) an element.
const viewApp = () => {
  const containerEl = h(
    'div',
    {className: 'container'},
  )
  const textEl = h('div', {className: 'text'})
  containerEl.append(textEl)

  const buttonEl = h('button', {className: 'button'}, 'Click to increment')
  containerEl.append(buttonEl)

  containerEl.render = (state, send) => {
    buttonEl.onclick = () => send(msg.increment)
    textEl.textContent = state.count
  }

  return containerEl
}

const app = ({count}) => ({count})

// Create initial state transaction
const init = () => next(app({count: 0}))

// Given previous state and an action, creates new state transactions.
const update = (state, msg) => {
  switch (msg.type) {
  case 'increment':
    return next(app({...state, count: state.count + 1}))
  default:
    return unknown(state, msg)
  }
}

const appEl = viewApp()
document.body.append(appEl)

// Initialize store
const send = useStore({
  debug: true,
  init,
  update,
  render: (state, send) => render(appEl, state, send)
})