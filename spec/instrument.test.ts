import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// This week's published spec (crits/04-instrument) turned into contract
// tests. Two lines are mechanically checkable from the built output; the
// rest — expressiveness, whether a stranger can play it uninstructed,
// whether it can be played "wrong" — only a person can judge, and are left
// to the crit. "Deployed and live", the invariant suite, and the process
// trail (PROCESS.md, reflections/crit-4.md, commit history) are covered
// elsewhere (ship/preflight and pnpm check:evidence), not here.

const distPath = resolve("dist/index.html");

// Every script the page actually ships: inline module scripts plus any
// external bundles Astro splits out once the code outgrows an inline
// script. Asserting on the contract (does it make sound live, does it
// listen for ordinary input) rather than on file layout, so this survives
// a restructure.
function shippedScriptText(): string {
  const html = readFileSync(distPath, "utf8");
  const doc = new JSDOM(html).window.document;
  const dir = dirname(distPath);
  return [...doc.querySelectorAll("script")]
    .map((script) => {
      const src = script.getAttribute("src");
      if (!src || /^https?:\/\//.test(src)) return script.textContent ?? "";
      const path = resolve(dir, src.replace(/^\//, ""));
      return existsSync(path) ? readFileSync(path, "utf8") : "";
    })
    .join("\n");
}

describe("instrument spec: sound is made live, not played back", () => {
  it("built the home page", () => {
    expect(
      existsSync(distPath),
      "run `pnpm build` first — these checks read the built site",
    ).toBe(true);
  });

  it("drives sound through the Web Audio API", () => {
    const js = shippedScriptText();
    expect(
      /AudioContext/.test(js),
      "no AudioContext in the shipped script — the spec asks for sound made live in the page, not a recording",
    ).toBe(true);
  });

  it("doesn't just embed a prerecorded track", () => {
    const doc = new JSDOM(readFileSync(distPath, "utf8")).window.document;
    const players = [...doc.querySelectorAll("audio, video")].filter((el) =>
      el.hasAttribute("src"),
    );
    expect(
      players,
      "an <audio>/<video> with a src plays back a recording — this instrument should synthesise live instead",
    ).toHaveLength(0);
  });
});

describe("instrument spec: playable with whatever is at hand", () => {
  it("listens for at least one ordinary input — pointer, keyboard, or touch", () => {
    const js = shippedScriptText();
    const ordinaryInput =
      /(pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|keydown|keyup)/.test(
        js,
      );
    expect(
      ordinaryInput,
      "no pointer/keyboard/touch listener found — the spec asks for something playable with a mouse, keyboard or touch, not specialised hardware",
    ).toBe(true);
  });
});
