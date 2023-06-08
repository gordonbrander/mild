import {ComponentElement, template} from '../../mild.js'

const Time = now => ({
  type: 'time',
  value: now
})

customElements.define('mild-app', class MildApp extends ComponentElement {
  static template = template(`
  <style>
  :host {
    display: block;
  }
  #time {
    font-family: monospace;
    font-size: 24px;
    font-weight: bold;
  }
  </style>
  <div id="root">
    <div id="time"></div>
    <button id="button">Click me</button>
  </div>
  `)

  static init() {
    return [
      {now: 0},
      Time(Date.now())
    ]
  }

  static update(state, msg) {
    if (msg.type === "time") {
      return [
        {...state, now: msg.value},
        null
      ]
    } else {
      return [state, null]
    }
  }

  static onEvent(event) {
    if (event.type === 'click' && event.target.id === 'button') {
      event.preventDefault()
      return Time(Date.now())
    }
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this.store)
  }

  write(state) {
    let time = this.shadowRoot.querySelector('#time')
    time.textContent = state.now
  }
})