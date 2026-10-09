# Reference rules (vendored, do not edit)
- `prototype-core.js`: the CORE block of the v2 `prototype.html`, unmodified.
- `sim-test.cjs`: the v2 `sim-test.js`, unmodified apart from the file extension. With `CORE` pointing at `prototype-core.js` and `RULES=build` it evaluates the exact rules the gates were tuned on.

`tests/parity.test.ts` plays the same campaigns through this reference and through `src/core`, and requires identical results.
