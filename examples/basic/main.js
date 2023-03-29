import {ComponentElement, JustFx, Update, query} from '../../mild.js'

const Time = now => ({
  type: 'time',
  value: now
})

customElements.define('mild-app', class MildApp extends ComponentElement {
  static template() {
    return `
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
    `
  }

  static init() {
    return Update(
      {now: 0},
      JustFx(Time(Date.now()))
    )
  }

  static update(state, msg) {
    if (msg.type === "time") {
      return Update({...state, now: msg.value})
    } else {
      return Update(state)
    }
  }

  write(state) {
    let button = this.shadowRoot.querySelector('#button')
    button.onclick = () => this.send(Time(Date.now()))
    let time = this.shadowRoot.querySelector('#time')
    time.textContent = state.now
  }
})