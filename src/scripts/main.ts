// A small live synthesizer. Each key is a real button bound to a physical
// key (A S D F G H J K) and to pointer input (mouse + touch). Every held
// note is its own oscillator + envelope voice, so chords work; all voices
// share one tone filter, one master gain, and one analyser feeding the
// visualizer canvas.

type Waveform = OscillatorType;
type Voice = { oscillator: OscillatorNode; gain: GainNode; keyEl: HTMLButtonElement };

const NOTE_BASE_FREQUENCY = 261.63; // C4
const ATTACK = 0.05; // seconds
const RELEASE = 0.15; // seconds
const PEAK_GAIN = 0.12; // per voice, kept low so chords don't clip
const TONE_SMOOTHING = 0.02; // seconds
const MIN_FILTER_CUTOFF = 200;
const MAX_FILTER_CUTOFF = 8000;
const OCTAVE_MIN = -2;
const OCTAVE_MAX = 2;

function expMap(t: number, outMin: number, outMax: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return outMin * (outMax / outMin) ** clamped;
}

const keyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".key"));
const codeToKey = new Map(keyButtons.map((keyEl) => [keyEl.dataset.code ?? "", keyEl]));

const waveformButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".waveform-button"),
);
const toneInput = document.querySelector<HTMLInputElement>("#tone");
const octaveDownButton = document.querySelector<HTMLButtonElement>("#octave-down");
const octaveUpButton = document.querySelector<HTMLButtonElement>("#octave-up");
const octaveValueOutput = document.querySelector<HTMLOutputElement>("#octave-value");
const canvas = document.querySelector<HTMLCanvasElement>("#visualizer");
const canvasCtx = canvas?.getContext("2d") ?? undefined;

let audioCtx: AudioContext | undefined;
let toneFilter: BiquadFilterNode | undefined;
let masterGain: GainNode | undefined;
let analyser: AnalyserNode | undefined;

const voices = new Map<string, Voice>();
const pressCounts = new Map<HTMLButtonElement, number>();
let currentWaveform: Waveform = "sine";
let octaveOffset = 0;

function semitoneToFrequency(semitone: number): number {
  return NOTE_BASE_FREQUENCY * 2 ** ((semitone + octaveOffset * 12) / 12);
}

function toneSliderToCutoff(value: number): number {
  return expMap(value, MIN_FILTER_CUTOFF, MAX_FILTER_CUTOFF);
}

function ensureAudioGraph(): void {
  if (audioCtx) return;

  audioCtx = new AudioContext();
  toneFilter = audioCtx.createBiquadFilter();
  masterGain = audioCtx.createGain();
  analyser = audioCtx.createAnalyser();

  toneFilter.type = "lowpass";
  toneFilter.frequency.value = toneSliderToCutoff(Number(toneInput?.value ?? 0.75));
  masterGain.gain.value = 0.9;
  analyser.fftSize = 1024;

  toneFilter.connect(masterGain).connect(analyser).connect(audioCtx.destination);
  startVisualizer();
}

function setPressed(keyEl: HTMLButtonElement, delta: number): void {
  const count = (pressCounts.get(keyEl) ?? 0) + delta;
  pressCounts.set(keyEl, count);
  keyEl.classList.toggle("pressed", count > 0);
}

function startVoice(id: string, keyEl: HTMLButtonElement): void {
  if (voices.has(id)) return;

  ensureAudioGraph();
  audioCtx?.resume();
  if (!audioCtx || !toneFilter) return;

  const semitone = Number(keyEl.dataset.semitone ?? 0);
  const oscillator = audioCtx.createOscillator();
  oscillator.type = currentWaveform;
  oscillator.frequency.value = semitoneToFrequency(semitone);

  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  oscillator.connect(gain).connect(toneFilter);
  oscillator.start();
  gain.gain.setTargetAtTime(PEAK_GAIN, audioCtx.currentTime, ATTACK);

  voices.set(id, { oscillator, gain, keyEl });
  setPressed(keyEl, 1);
}

function stopVoice(id: string): void {
  const voice = voices.get(id);
  if (!voice || !audioCtx) return;

  voices.delete(id);
  const { oscillator, gain, keyEl } = voice;
  const now = audioCtx.currentTime;
  gain.gain.setTargetAtTime(0, now, RELEASE);
  oscillator.stop(now + RELEASE * 5);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    gain.disconnect();
  });
  setPressed(keyEl, -1);
}

function releaseAllVoices(): void {
  for (const id of [...voices.keys()]) stopVoice(id);
}

function setActiveWaveformButton(button: HTMLButtonElement): void {
  for (const b of waveformButtons) b.classList.toggle("active", b === button);
}

for (const button of waveformButtons) {
  if (button.dataset.waveform === currentWaveform) setActiveWaveformButton(button);
  button.addEventListener("click", () => {
    const waveform = button.dataset.waveform as Waveform | undefined;
    if (!waveform) return;
    currentWaveform = waveform;
    setActiveWaveformButton(button);
    for (const { oscillator } of voices.values()) oscillator.type = currentWaveform;
  });
}

toneInput?.addEventListener("input", () => {
  if (!audioCtx || !toneFilter) return;
  const cutoff = toneSliderToCutoff(Number(toneInput.value));
  toneFilter.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, TONE_SMOOTHING);
});

function updateOctaveControls(): void {
  if (octaveValueOutput) octaveValueOutput.textContent = String(octaveOffset);
  if (octaveDownButton) octaveDownButton.disabled = octaveOffset <= OCTAVE_MIN;
  if (octaveUpButton) octaveUpButton.disabled = octaveOffset >= OCTAVE_MAX;
}

function changeOctave(delta: number): void {
  const next = Math.min(Math.max(octaveOffset + delta, OCTAVE_MIN), OCTAVE_MAX);
  if (next === octaveOffset) return;
  octaveOffset = next;
  updateOctaveControls();

  if (!audioCtx) return;
  const factor = 2 ** delta;
  const now = audioCtx.currentTime;
  for (const { oscillator } of voices.values()) {
    oscillator.frequency.setValueAtTime(oscillator.frequency.value * factor, now);
  }
}

octaveDownButton?.addEventListener("click", () => changeOctave(-1));
octaveUpButton?.addEventListener("click", () => changeOctave(1));
updateOctaveControls();

for (const keyEl of keyButtons) {
  keyEl.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    keyEl.setPointerCapture(event.pointerId);
    startVoice(`pointer:${event.pointerId}`, keyEl);
  });
  keyEl.addEventListener("pointerup", (event) => stopVoice(`pointer:${event.pointerId}`));
  keyEl.addEventListener("pointercancel", (event) => stopVoice(`pointer:${event.pointerId}`));
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const keyEl = codeToKey.get(event.code);
  if (!keyEl) return;
  startVoice(`key:${event.code}`, keyEl);
});

window.addEventListener("keyup", (event) => {
  if (!codeToKey.has(event.code)) return;
  stopVoice(`key:${event.code}`);
});

window.addEventListener("blur", releaseAllVoices);

function startVisualizer(): void {
  if (!canvas || !canvasCtx || !analyser) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvasCtx.scale(dpr, dpr);

  const data = new Uint8Array(analyser.fftSize);

  function draw(): void {
    if (!canvasCtx || !analyser || !canvas) return;
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(data);

    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.strokeStyle = "#0b5fff";
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();

    const step = width / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 255) * height;
      const x = i * step;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();
  }

  requestAnimationFrame(draw);
}
