// Minimal shared assertion helper for widget unit tests, so each test file
// doesn't reinvent it. Counters are module-level and thus shared across every
// test file the runner imports; tools/test-unit.js reads them to set exit code.
let ran = 0;
let failed = 0;

export function check(name, condition) {
  ran += 1;
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${name}`);
  }
}

export function approx(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}

export function results() {
  return { ran, failed };
}
