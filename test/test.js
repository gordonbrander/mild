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

export function assert(isTrue, msg='') {
  if (!isTrue) {
    throw new AssertionError(msg);
  }
}
