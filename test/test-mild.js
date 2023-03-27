import {
  Fx, JustFx, MapFx, BatchFx, NoFx, Update, TagItem,
  Fragment, query
} from '../mild.js'
import {test, assert} from './test.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test('Fx returns a function', () => {
  let fx = Fx(sleep(1))
  assert(typeof fx === 'function', 'fx is a function')
})

test('Fx calls send when complete', async () => {
  let fx = Fx(sleep(1))
  let complete = new Promise(resolve => {
    fx(resolve)
  })
  await complete
  assert(true, 'fx called send')
})

test('JustFx just sends the value', async () => {
  let fx = JustFx(10)
  let value = await new Promise(resolve => {
    fx(resolve)
  })
  assert(value === 10, 'Just sent the value')
})

test('MapFx transforms the value using tag function', async () => {
  const square = x => x * x

  let fx = MapFx(JustFx(2), square) 
  let value = await new Promise(resolve => {
    fx(resolve)
  })
  assert(value === 4, 'MapFx transformed the value')
})

test('BatchFx runs all effects', async () => {
  let fx = BatchFx([JustFx(2), JustFx(1), JustFx(3)]) 
  var array = []
  fx(value => array.push(value))
  await sleep(1)
  assert(array.length === 3)
})

test('NoFx has no effect', async () => {
  let didRun = false
  NoFx(() => {
    didRun = true
  })
  await sleep(1)
  assert(didRun === false, "Did not run")
})

test('Update returns an array of state and fx', () => {
  let state = {a: 10}
  let fx = JustFx(10)
  let next = Update(state, fx)
  assert(next[0] === state, "First in array is state that was passed")
  assert(next[1] === fx, "Second in array is fx that was passed")
})

test('Update defaults to NoFx', () => {
  let [state, fx] = Update({a: 10})
  assert(fx === NoFx, "Fx defaults to NoFx")
})

test('TagItem returns a tagging function', () => {
  let Item = TagItem(1)
  assert(typeof Item === 'function', "Returns a function")
  let foo = {type: 'Foo'}
  let tagged = Item(foo)
  assert(tagged.type === 'item', "type is item")
  assert(tagged.id === 1, "id is passed ID")
  assert(tagged.value === foo, "value is wrapped message")
})

test('Fragment returns a document fragment', () => {
  let frag = Fragment(`
  <div id="test">
    <h1 id="title">Success</h1>
  </div>
  `)
  
  assert(frag instanceof DocumentFragment, 'Returns a DocumentFragment')
  let el = frag.firstElementChild
  assert(el.tagName === 'DIV', 'Created a div')
  assert(el.id === 'test', 'Has correct ID')
  assert(el.firstElementChild.tagName === 'H1', 'Has correct child element')
})

test('query finds element in scope', () => {
  let frag = Fragment(`
  <div class="foo">
    <p id="bar">Bar</p>
    <p id="baz">Baz</p>
  </div>
  `)
  let match = query(frag, '.foo p:nth-child(2)')
  assert(match.id === 'baz')
})