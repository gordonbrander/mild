import {
  Store,
  next,
  view,
  list,
  model,
  cloning,
  cid,
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
export const css = style => cloning(() => {
  let styleEl = document.createElement('style')
  styleEl.innerText = style
  return styleEl
})

const checkboxView = view({
  tag: 'input',
  setup: (el, isChecked, send) => {
    el.type = 'checkbox'
    el.className = 'todo-check'
  },
  render: (el, isChecked, send) => {
    prop(el, 'checked', isChecked)
  }
})

const todoTitleView = view({
  setup: (el, title, send) => {
    el.className = 'todo-title'
  },
  render: (el, title, send) => {
    el.innerText = title
  }
})

const todoView = view({
  setup: (el, state, send) => {
    el.className = 'todo-item'
    el.onchange = event => {
      if (event.target.classList.contains('todo-check')) {
        send(action.checkTodo(state.id, event.target.checked))
      }
    }
    el.append(checkboxView.create(state.isChecked, send))
    el.append(todoTitleView.create(state.title))
  },
  render: (el, state, send) => {
    el.classList.toggle('checked', state.isChecked)

    let titleEl = $(el, '.todo-title')
    todoTitleView.render(titleEl, state.title, send)

    let checkboxEl = $(el, '.todo-check')
    checkboxView.render(checkboxEl, state.isChecked, send)
  }
})

const todoInputView = view({
  tag: 'input',
  setup: (input, state, send) => {
    input.type = 'text'
    input.className = 'todo-input'
    input.placeholder = 'What needs to be done?'
    input.oninput = event => send(action.setInput(event.target.value))
    input.onkeyup = event => {
      if (event.key === 'Enter') {
        send(action.submitTodo(event.target.value))
      }
    }
  },
  render: (input, value, send) => {
    prop(input, 'value', value)
  }
})

const filterButtonView = view({
  tag: 'button',
  setup: (element, state, send) => {
    element.classList.add('button', 'todo-filter', state.className)
    element.onclick = send
  },
  render: (element, state, send) => {
    prop(element, 'innerText', state.title)
  }
})

const filterView = view({
  setup: (element, state, send) => {
    element.classList.add('todo-filters')
    element.append(
      filterButtonView.create(
        {
          title: 'All',
          className: 'todo-filter-all'
        },
        event => send(action.filterAll)
      )
    )
    element.append(
      filterButtonView.create(
        {
          title: 'Active',
          className: 'todo-filter-active'
        },
        event => send(action.filterActive)
      )
    )
    element.append(
      filterButtonView.create(
        {
          title: 'Completed',
          className: 'todo-filter-completed'
        },
        event => send(action.filterCompleted)
      )
    )
    element.append(
      filterButtonView.create(
        {
          title: 'Clear Completed',
          className: 'todo-filter-clear'
        },
        event => send(action.clearCompleted)
      )
    )
  },
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
  setup: (element, state, send) => {
    element.classList.add('todo-app')

    element.attachShadow({mode: 'open'})
    element.shadowRoot.append(appStyles())
    element.shadowRoot.append(todoInputView.create(state.input, send))

    let listEl = document.createElement('div')
    listEl.classList.add('todo-lsit')
    element.shadowRoot.append(listEl)

    element.shadowRoot.append(filterView.create(state.filter, send))
  },
  render: (element, state, send) => {
    let inputEl = $(element.shadowRoot, '.todo-input')
    todoInputView.render(inputEl, state.input, send)

    let listEl = $(element.shadowRoot, '.todo-list')

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

    let filterEl = $(element.shadowRoot, '.todo-filters')
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