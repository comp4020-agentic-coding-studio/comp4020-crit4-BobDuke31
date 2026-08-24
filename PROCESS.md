# Process overview

## What I built

I built a browser-based piano synthesizer using the Web Audio API. The final version has two octaves of white and black keys, supports physical keyboard, mouse and touch input, and allows multiple notes to be played together. It also includes waveform selection, tone and octave controls, and a live audio visualizer.

## The moments that mattered

### 1. Changing the interaction after testing the first prototype

My first working version was a pointer driven theremin. It passed the automated checks and worked with mouse and touch, but when I opened it myself I found the interaction too abstract and the page too empty. I decided not to keep improving that design. I looked at examples such as the MDN synth, Patatap and Chrome Music Lab, then changed the main interaction to a visible piano keyboard.

Evidence: [`071bb39...1f49d67`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-BobDuke31/compare/071bb39...1f49d67)

### 2. Checking the finished interface instead of relying only on the tests

After the piano version was working, I asked the agent to audit the keyboard layout, controls and responsive behaviour. The audit found that the black keys were positioned incorrectly and that the mobile layout made part of the keyboard difficult to reach. I had those problems fixed and checked the page again at desktop and mobile sizes. `pnpm check` then passed with all 21 tests.

Evidence: [`1f49d67`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-BobDuke31/commit/1f49d67)