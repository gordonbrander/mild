import {
  ViewElement,
  template,
  cid
} from '../mild.js'
import {test, assert} from './test.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test('template returns a template', () => {
  let html = template(`
  <div id="test">
    <h1 id="title">Success</h1>
  </div>
  `)
  
  assert(html instanceof HTMLTemplateElement, 'Returns a HTMLTemplateElement')
  let frag = html.content.cloneNode(true)
  let el = frag.firstElementChild
  assert(el.tagName === 'DIV', 'Created a div')
  assert(el.id === 'test', 'Has correct ID')
  assert(el.firstElementChild.tagName === 'H1', 'Has correct child element')
})

customElements.define(
  'test-shadow-dom-scaffold-element',
  class TestShadowDomScaffoldElement extends ViewElement {
    static template = template(`<div id="test"></div>`)
  }
)

test('TemplateElement scaffolds its shadow dom from static template', () => {
  let el = document.createElement('test-shadow-dom-scaffold-element')
  assert(el.shadowRoot != null, 'Element has an open shadow dom')

  let child = el.shadowRoot.querySelector('#test')
  assert(child.id === 'test', 'Shadow dom is scaffolded with template')
})

test('cid autoincrements', () => {
  let first = cid()
  let second = cid()
  let third = cid()
  assert(first !== second, "Generates fresh cid")
  assert(second !== third, "Generates fresh cid")
})