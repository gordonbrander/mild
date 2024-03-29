// Test utilities

export const test = async (msg, callback) => {
  try {
    await callback()
    console.log(`OK: ${msg}`)
    return true
  } catch (error) {
    console.log(`FAIL: ${msg}`)
    console.error(error)
    return false
  }
}

export class AssertionError extends Error {}

export const fail = msg => {
  throw new AssertionError(msg)
}

export const assert = (isTrue, msg='') => {
  if (!isTrue) {
    throw new AssertionError(msg);
  }
}

export class Runner {
  tests = new Map()

  suite(name, callback) {
    this.tests.set(name, callback)
  }

  async run() {
    for (let [name, callback] of this.tests.entries()) {
      console.group(`SUITE: ${name}`)
      await callback()
      console.groupEnd()
    }
  }
}

export const wait = ms => new Promise(resolve => {
  setTimeout(resolve, ms)
})