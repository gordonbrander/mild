import {test, Runner, assert, fail, wait} from './test.js'
import {
  insertElementAt,
  list,
  cid,
  next,
  prop
} from '../mild.js'

const insertAtIndex = (array, i, item) => {
  array.splice(i, 0, item)
}

const removeAtIndex = (array, i) => {
  let removed = array.splice(i, 1)
  return removed[0]
}

let runner = new Runner()

runner.suite('insertElementAt', async () => {
  const createParent = () => {
    let list = document.createElement('ul')
    list.className = 'list'
    return list
  }

  const createItem = () => {
    let item = document.createElement('li')
    item.className = 'item'
    return item
  }

  await test('it appends when there are no children', () => {
    let parent = createParent()
    let item = createItem()
    insertElementAt(parent, item, 0)

    assert(parent.firstElementChild === item, "item is appended")
  })

  await test('it appends when index is out of range', () => {
    let parent = createParent()
    let item = createItem()
    insertElementAt(parent, item, 1000)

    assert(parent.firstElementChild === item, "item is appended")
  })

  await test('it does not move element when element is already at index', async () => {
    let parent = createParent()

    let item = createItem()
    insertElementAt(parent, item, 0)

    let observer = new MutationObserver((mutationList, observer) => {
      fail("Child list was mutated, but should not have been")
    })

    observer.observe(parent, {childList: true})
    insertElementAt(parent, item, 0)
    insertElementAt(parent, item, 0)
    insertElementAt(parent, item, 0)
    await wait(1)
    observer.disconnect()
  })
})

runner.suite('list', async () => {
  const send = () => {}

  const item = () => {
    let item = document.createElement('li')
    item.className = 'item'
    item.render = (state, send) => {
      item.innerText = state.text
    }
    return item
  }

  const renderList = list(item)

  const model = ({text}) => ({id: cid(), text})

  const init = (n=100) => {
    let array = []
    for (var i = 0; i < n; i++) {
      array.push(
        model({text: `Item ${i}`})
      )
    }
    return array
  }

  const createParent = () => {
    let list = document.createElement('ul')
    list.className = 'list'
    return list
  }

  await test('it appends children on empty element', () => {
    let states = init(10)
    let parent = createParent()
    renderList(parent, states, send)
    assert(parent.children.length === 10, "appends children")
  })

  await test('it removes elements', () => {
    let states = init(10)
    let parent = createParent()
    renderList(parent, states)

    let copy = [...states]
    copy.pop()
    copy.pop()

    renderList(parent, copy, send)
    assert(parent.children.length === 8, "removes children")
  })

  await test('it supports inserting and removing elements anywhere', () => {
    let states = init(10)
    let parent = createParent()
    renderList(parent, states, send)

    let previousChildren = Array.from(parent.children)

    let copy = [...states]
    insertAtIndex(copy, 4, model({text: 'Added item'}))
    insertAtIndex(copy, 7, model({text: 'Added item'}))
    removeAtIndex(copy, 9)

    renderList(parent, copy, send)
    assert(parent.children.length === 11, "correct number of children")
    assert(parent.children[5] === previousChildren[4], "Other elements don't get replaced")
  })

  await test('it avoids reparenting elements that remain in same relative order', async () => {
    let states = init(5)
    let parent = createParent()
    renderList(parent, states, send)

    let copy = [...states]
    removeAtIndex(copy, 0)
    insertAtIndex(copy, 0, model({text: 'Added item'}))
    insertAtIndex(copy, 0, model({text: 'Added item'}))
    insertAtIndex(copy, 3, model({text: 'Added item'}))
    insertAtIndex(copy, 3, model({text: 'Added item'}))
    insertAtIndex(copy, 4, model({text: 'Added item'}))

    let referenceElement1 = parent.children[1]
    let referenceElement2 = parent.children[2]
    let referenceElement4 = parent.children[4]

    let observer = new MutationObserver((mutationList, observer) => {
      let added = new Set(
        mutationList.flatMap(mutation => Array.from(mutation.addedNodes))
      )
      let removed = new Set(
        mutationList.flatMap(mutation => Array.from(mutation.removedNodes))
      )

      assert(
        added.size === 5,
        'It performs only the additions necessary'
      )

      assert(
        removed.size === 1,
        'It performs only the removals necessary'
      )

      assert(
        !added.has(referenceElement1),
        'Reference element is not moved'
      )
      assert(
        !removed.has(referenceElement1),
        'Reference element is not moved'
      )
      assert(
        !added.has(referenceElement2),
        'Reference element is not moved'
      )
      assert(
        !removed.has(referenceElement2),
        'Reference element is not moved'
      )
      assert(
        !added.has(referenceElement4),
        'Reference element is not moved'
      )
      assert(
        !removed.has(referenceElement4),
        'Reference element is not moved'
      )
    })

    observer.observe(parent, {childList: true})
    renderList(parent, copy, send)

    assert(parent.children.length === 9, "list is correct length after rendering")

    await wait(1)

    observer.disconnect()
  })

  await test('it reparents elements that change order', async () => {
    let states = init(3)
    let parent = createParent()
    renderList(parent, states, send)

    let copy = [...states]
    let last = copy.pop()
    copy.unshift(last)

    let referenceElement0 = parent.children[0]

    let observer = new MutationObserver((mutationList, observer) => {
      let added = new Set(
        mutationList.flatMap(mutation => Array.from(mutation.addedNodes))
      )
      let removed = new Set(
        mutationList.flatMap(mutation => Array.from(mutation.removedNodes))
      )
      assert(
        !added.has(referenceElement0),
        'Reference element is not moved'
      )
      assert(
        !removed.has(referenceElement0),
        'Reference element is not moved'
      )
    })

    observer.observe(parent, {childList: true})
    list(item, parent, copy, send)

    assert(parent.children.length === 3, "list is correct length after rendering")

    await wait(1)

    observer.disconnect()
  })
})

runner.suite('next', async () => {
  await test('it returns state and effects', () => {
    let state = {}
    let effects = []
    let update = next(state, effects)

    assert(update.state === state)
    assert(update.effects === effects)
  })
})

runner.suite('prop', async () => {
  await test('it only sets property if value has changed', async () => {
    let mutations = 0
    let observer = new MutationObserver((mutationList, observer) => {
      mutations = mutations + 1
    })

    let element = document.createElement('div')
    element.id = 'foo'
    element.dataset.key = 'foo'
    observer.observe(element, {attributes: true})
    prop(element, 'id', 'bar')
    prop(element, 'id', 'bar')
    prop(element.dataset, 'key', 'foo')

    await wait(1)
    observer.disconnect()

    assert(mutations === 1, 'prop only mutated when value changed')
  })
})

runner.run()