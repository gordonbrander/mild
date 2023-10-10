import {
  Store,
  next,
  view,
  item,
  list,
  model,
  cloning,
  cid,
  h,
  $,
  prop
} from '../../mild.js'

const freeze = Object.freeze

const Filter = freeze({
  all: 'all',
  active: 'active',
  completed: 'completed'
})

const actionOf = type => value => freeze({
  type,
  value
})

const action = {}

action.submitTodo = actionOf('submitTodo')
action.setInput = actionOf('setInput')
action.checkTodo = (id, isChecked) => freeze({
  type: 'checkTodo',
  id,
  isChecked
})
action.clearCompleted = freeze({type: 'clearCompleted'})
action.filter = actionOf('filter')
action.filterAll = action.filter(Filter.all)
action.filterActive = action.filter(Filter.active)
action.filterCompleted = action.filter(Filter.completed)

// Returns a function to create a style element
export const css = style => cloning(() => h('style', {}, style))

const checkboxView = view({
  create: (isChecked, send) => h(
    'input',
    {
      type: 'checkbox',
      className: 'todo-check'
    }
  ),
  render: (el, isChecked, send) => {
    prop(el, 'checked', isChecked)
  }
})

const todoView = view({
  create: (state, send) => h(
    'div',
    {
      className: 'todo-item',
      onchange: event => {
        if (event.target.classList.contains('todo-check')) {
          send(action.checkTodo(state.id, event.target.checked))
        }
      }
    },
    checkboxView.create(state.isChecked, send),
    h('div', {className: 'todo-title'})
  ),
  render: (div, state, send) => {
    div.classList.toggle('checked', state.isChecked)

    let titleEl = $(div, '.todo-title')
    prop(titleEl, 'innerText', state.title)

    let checkboxEl = $(div, '.todo-check')
    checkboxView.render(checkboxEl, state.isChecked, send)
  }
})

const todoInputView = view({
  create: (value, send) => h(
    'input',
    {
      type: 'text',
      className: 'todo-input',
      placeholder: 'What needs to be done?',
      oninput: event => send(action.setInput(event.target.value)),
      onkeyup: event => {
        if (event.keyCode === 13) {
          send(action.submitTodo(event.target.value))
        }
      }
    }
  ),
  render: (input, value, send) => {
    prop(input, 'value', value)
  }
})

const filterView = view({
  create: (filter, send) => h(
    'div',
    {
      className: 'todo-filters',
    },
    h(
      'button',
      {
        className: 'button todo-filter todo-filter-all',
        onclick: event => send(action.filterAll)
      },
      'All'
    ),
    h(
      'button',
      {
        className: 'button todo-filter todo-filter-active',
        onclick: event => send(action.filterActive)
      },
      'Active'
    ),
    h(
      'button',
      {
        className: 'button todo-filter todo-filter-completed',
        onclick: event => send(action.filterCompleted)
      },
      'Completed'
    ),
    h(
      'button',
      {
        className: 'button todo-filter todo-filter-clear',
        onclick: event => send(action.clearCompleted)
      },
      'Clear Completed'
    )
  ),
  render: (el, filter, send) => {
    let allEl = $(el, '.todo-filter-all')
    allEl.classList.toggle('active', filter === Filter.all)

    let activeEl = $(el, '.todo-filter-active')
    activeEl.classList.toggle('active', filter === Filter.active)

    let completedEl = $(el, '.todo-filter-completed')
    completedEl.classList.toggle('active', filter === Filter.completed)
  }
})

const appStyles = css(`
:host {
  font-size: 16px;
  line-height: 16px;
}

* {
  box-sizing: border-box;
}

.button {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  background: #fff;
}

.button.active {
  background: #eee;
}

.button:active {
  background: #eee;
}

.todo-item {
  border-bottom: 1px solid #eee;
  padding: 8px 0;
  display: flex;
  gap: 16px;
}

.filter-active .todo-item-checked {
  display: none;
}

.filter-active .todo-item.checked {
  display: none;
}

.filter-completed .todo-item:not(.checked) {
  display: none;
}

.todo-filters {
  display: flex;
  padding: 16px 0;
  gap: 16px;
}

.todo-input {
  font-size: 18px;
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.todo-check {
  display: block;
  border: 0;
  margin: 4px;
  padding: 0;
  width: 24px;
  height: 24px;
}

.todo-title {
  font-size: 18px;
  border: 0;
  display: block;
  line-height: 32px;
  margin: 0;
  height: 32px;
  width: 100%;
}
`)

const appView = view({
  create: (state, send) => {
    let divEl = h('div', {className: 'todo-app'})

    divEl.attachShadow({mode: 'open'})
    divEl.shadowRoot.append(appStyles())
    divEl.shadowRoot.append(todoInputView.create(state.input, send))

    let listEl = h('div', {className: 'todo-list'})
    divEl.shadowRoot.append(listEl)

    divEl.shadowRoot.append(filterView.create(state.filter, send))

    return divEl
  },
  render: (el, state, send) => {
    let inputEl = $(el.shadowRoot, '.todo-input')
    todoInputView.render(inputEl, state.input, send)

    let listEl = $(el.shadowRoot, '.todo-list')

    listEl.classList.toggle(
      'filter-all',
      state.filter === Filter.all
    )
    listEl.classList.toggle(
      'filter-active',
      state.filter === Filter.active
    )
    listEl.classList.toggle(
      'filter-completed',
      state.filter === Filter.completed
    )

    list(todoView, listEl, state.items, send)

    let filterEl = $(el.shadowRoot, '.todo-filters')
    filterView.render(filterEl, state.filter, send)
  }
})

const todoModel = model(({
  id=cid(),
  title,
  isChecked=false
}) => ({
  id,
  title,
  isChecked
}))

const appModel = model(({
  items,
  input='',
  filter=Filter.all
}) => ({
  items,
  input,
  filter
}))

const init = () => {
  const items = []
  for (var i = 0; i < 5; i++) {
    items.push(todoModel({title: `Item ${i}`}))
  }
  let model = appModel({items})
  return next(model)
}

const insertAtIndex = (array, i, item) => {
  array.splice(i, 0, item);
}

const removeAtIndex = (array, i) => {
  array.splice(i, 1);
}

const submitTodo = (state, title) => next(
  appModel({
    ...state,
    input: '',
    items: freeze([
      ...state.items,
      todoModel({title})
    ])
  })
)

const setInput = (state, value) => next(
  appModel({
    ...state,
    input: value
  })
)

const updateFilter = (state, filter) => next(
  appModel({
    ...state,
    filter
  })
)

const checkTodo = (state, id, isChecked) => {
  let i = state.items.findIndex(item => item.id === id)
  if (i < 0) {
    console.log(`No item found for id ${id}`)
    return next(state)
  }

  let item = todoModel({
    ...state.items[i],
    isChecked: isChecked
  })

  let items = [...state.items]
  items[i]= item

  return next(
    appModel({
      ...state,
      items
    })
  )
}

const clearCompleted = state => {
  let items = state.items.filter(item => !item.isChecked)
  return next(
    appModel({
      ...state,
      items
    })
  )
}

const update = (state, action) => {
  switch (action.type) {
  case 'submitTodo':
    return submitTodo(state, action.value)
  case 'setInput':
    return setInput(state, action.value)
  case 'clearCompleted':
    return clearCompleted(state)
  case 'checkTodo':
    return checkTodo(state, action.id, action.isChecked)
  case 'filter':
    return updateFilter(state, action.value)
  default:
    console.warn("Unhandled action type", action)
    return next(state)
  }
}

let store = new Store({
  host: document.querySelector('body'),
  view: appView,
  init,
  update
})