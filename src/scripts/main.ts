// A pointer-driven theremin. Press and drag anywhere on #pad: left/right
// sets pitch, up/down sets tone (a lowpass filter's cutoff). One oscillator
// and filter run continuously once started; the gain node is the only thing
// that opens and closes, so start/stop is a smooth ramp, never a click.

const pad = document.querySelector<HTMLElement>("#pad");
const cursor = document.querySelector<HTMLElement>("#cursor");

const MIN_FREQUENCY = 110; // A2
const MAX_FREQUENCY = 880; // A5
const MIN_FILTER_CUTOFF = 200;
const MAX_FILTER_CUTOFF = 5000;
const PARAM_SMOOTHING = 0.015; // seconds — removes zipper noise between pointermove events
const ATTACK = 0.05; // seconds
const RELEASE = 0.15; // seconds
const PEAK_GAIN = 0.2;

// Perceived pitch and brightness are both roughly logarithmic, so an even
// sweep across the pad should move exponentially through the range, not
// linearly.
function expMap(value: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.min(Math.max(value / inMax, 0), 1);
  return outMin * (outMax / outMin) ** t;
}

let audioCtx: AudioContext | undefined;
let oscillator: OscillatorNode | undefined;
let filter: BiquadFilterNode | undefined;
let gain: GainNode | undefined;
let activePointerId: number | undefined;

function ensureAudioGraph(): void {
  if (audioCtx) return;

  audioCtx = new AudioContext();
  oscillator = audioCtx.createOscillator();
  filter = audioCtx.createBiquadFilter();
  gain = audioCtx.createGain();

  oscillator.type = "sine";
  filter.type = "lowpass";
  gain.gain.value = 0;

  oscillator.connect(filter).connect(gain).connect(audioCtx.destination);
  oscillator.start();
}

function updateParams(x: number, y: number): void {
  if (!audioCtx || !oscillator || !filter || !pad) return;

  const { width, height } = pad.getBoundingClientRect();
  const frequency = expMap(x, width, MIN_FREQUENCY, MAX_FREQUENCY);
  const cutoff = expMap(y, height, MAX_FILTER_CUTOFF, MIN_FILTER_CUTOFF);

  oscillator.frequency.setTargetAtTime(frequency, audioCtx.currentTime, PARAM_SMOOTHING);
  filter.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, PARAM_SMOOTHING);
}

function moveCursor(x: number, y: number): void {
  cursor?.style.setProperty("transform", `translate(${x}px, ${y}px)`);
}

function setCursorActive(active: boolean): void {
  cursor?.classList.toggle("active", active);
}

function play(x: number, y: number): void {
  ensureAudioGraph();
  audioCtx?.resume();
  updateParams(x, y);
  gain?.gain.setTargetAtTime(PEAK_GAIN, audioCtx!.currentTime, ATTACK);
}

function stop(): void {
  gain?.gain.setTargetAtTime(0, audioCtx!.currentTime, RELEASE);
}

pad?.addEventListener("pointerdown", (event) => {
  activePointerId = event.pointerId;
  pad.setPointerCapture(event.pointerId);
  moveCursor(event.clientX, event.clientY);
  setCursorActive(true);
  play(event.clientX, event.clientY);
});

pad?.addEventListener("pointermove", (event) => {
  moveCursor(event.clientX, event.clientY);
  if (event.pointerId !== activePointerId) return;
  updateParams(event.clientX, event.clientY);
});

function release(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) return;
  activePointerId = undefined;
  setCursorActive(false);
  stop();
}

pad?.addEventListener("pointerup", release);
pad?.addEventListener("pointercancel", release);
