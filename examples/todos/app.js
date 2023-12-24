import {
  useStore,
  next,
  render,
  list,
  model,
  cid,
  h,
  prop,
  text,
  unknown
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
export const css = style => h('style', {}, style)

const checkboxView = () => {
  const inputEl = h('input', {type: 'checkbox', className: 'todo-check'})

  inputEl.render = (isChecked, send) => {
    prop(inputEl, 'checked', isChecked)
  }

  return inputEl
}

const todoTitleView = () => {
  const titleEl = h('div', {className: 'todo-title'})

  titleEl.render = (title, send) => {
    text(titleEl, title)
  }

  return titleEl
}

const todoView = () => {
  const todoEl = h(
    'div',
    {className: 'todo-item'},
  )

  const checkboxEl = checkboxView()
  todoEl.append(checkboxEl)

  const titleEl = todoTitleView()
  todoEl.append(titleEl)

  todoEl.render = ({id, title, isChecked}, send) => {
    todoEl.classList.toggle('checked', isChecked)

    todoEl.onchange = event => {
      if (event.target.classList.contains('todo-check')) {
        send(action.checkTodo(id, event.target.checked))
      }
    }

    render(titleEl, title, send)
    render(checkboxEl, isChecked, send)
  }

  return todoEl
}

const todoInputView = () => {
  const inputEl = h(
    'input',
    {
      type: 'text',
      className: 'todo-input',
      placeholder: 'What needs to be done?'
    }
  )

  inputEl.render = (value, send) => {
    prop(inputEl, 'value', value)
    inputEl.oninput = event => send(action.setInput(event.target.value))
    inputEl.onkeyup = event => {
      if (event.key === 'Enter') {
        send(action.submitTodo(event.target.value))
      }
    }
  }

  return inputEl
}

const createFilterButton = (title, className) => h(
  'button',
  {className: `button todo-filter ${className}`},
  title
)

const filterView = () => {
  const filtersEl = h(
    'div',
    {className: 'todo-filters'},
  )
  const allEl = createFilterButton('All', 'todo-filter-all')
  filtersEl.append(allEl)

  const activeEl = createFilterButton('Active', 'todo-filter-active')
  filtersEl.append(activeEl)

  const completedEl = createFilterButton('Completed', 'todo-filter-completed')
  filtersEl.append(completedEl)

  const clearEl = createFilterButton('Clear Completed', 'todo-filter-clear')
  filtersEl.append(clearEl)

  filtersEl.render = (filter, send) => {
    allEl.classList.toggle('active', filter === Filter.all)
    allEl.onclick = event => send(action.filterAll)

    activeEl.classList.toggle('active', filter === Filter.active)
    activeEl.onclick = event => send(action.filterActive)

    completedEl.classList.toggle('active', filter === Filter.completed)
    completedEl.onclick = event => send(action.filterCompleted)

    clearEl.onclick = event => send(action.clearCompleted)
  }

  return filtersEl
}

const appStyles = css(`
:host {
  font-size: 16px;
  line-height: 16px;
  font-family: sans-serif;
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

const appView = () => {
  const element = h('div', {className: 'todo-app'})
  element.attachShadow({mode: 'open'})

  element.shadowRoot.append(appStyles)

  const inputEl = todoInputView()
  element.shadowRoot.append(inputEl)

  const listEl = h('div', {className: 'todo-list'})
  element.shadowRoot.append(listEl)
  const renderListEl = list(todoView)  

  const filterEl = filterView()
  element.shadowRoot.append(filterEl)

  element.render = (state, send) => {
    render(inputEl, state.input, send)

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

    renderListEl(listEl, state.items, send)

    render(filterEl, state.filter, send)
  }

  return element
}

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
    return unknown(state, action)
  }
}

const init = () => {
  const items = []
  for (var i = 0; i < 5; i++) {
    items.push(todoModel({title: `Item ${i}`}))
  }
  let model = appModel({items})
  return next(model)
}

const appEl = appView()
document.body.append(appEl)

const send = useStore({
  debug: true,
  init,
  update,
  render: (state, send) => render(appEl, state, send)
})