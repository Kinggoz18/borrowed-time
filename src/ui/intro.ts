/**
 * Six-line story intro (docs/INTRO_DIALOGUE.md): portraits, typewriter, skippable.
 */
import { h } from "./dom";

export interface IntroLine {
  speaker: string;
  side: "left" | "right";
  portrait: string;
  text: string;
}

/**
 * Six lines, one scene (docs/INTRO_DIALOGUE.md). Every line is spoken to someone and answers the
 * one before it: Nell wakes Noon on the beach, Noon asks, Hesper answers, Tobias warns about the
 * debt, Ada warns about the dusk raiders, Noon sets the first goal.
 */
export const INTRO_LINES: IntroLine[] = [
  { speaker: "Nell", side: "right", portrait: "/portraits/nell.webp", text: "Noon! Wake up. The Patience broke on the reef. Six of us got ashore, and you." },
  { speaker: "Noon", side: "left", portrait: "/portraits/noon.webp", text: "Nell... where are we? Whose tent is that?" },
  { speaker: "Hesper", side: "right", portrait: "/portraits/hesper.webp", text: "Mine. Welcome ashore, Noon. I am Hesper, the Clockkeeper. You have eight Hours between you, and I lend more." },
  { speaker: "Tobias", side: "right", portrait: "/portraits/tobias.webp", text: "Careful, Noon. Every hour she lends comes due at dusk, with a little extra. We ran from Aster to get away from that." },
  { speaker: "Ada", side: "right", portrait: "/portraits/ada.webp", text: "And dusk brings the Late, rowing in from islands that ran out of time. They want Hours, not blood. Walls turn them back." },
  { speaker: "Noon", side: "left", portrait: "/portraits/noon.webp", text: "Then we build before dark. The Palisade first." },
];

/** The tent comes into view for Hesper's line, the whole island for the closing line. */
export const INTRO_CAMERA = { tent: 2, fit: 5 } as const;

export function runIntro(host: HTMLElement, onDone: () => void, onCamera?: (line: number) => void): () => void {
  let line = 0;
  let typing: ReturnType<typeof setInterval> | null = null;
  let done = false;
  const skip = h("button", { class: "btn intro-skip", type: "button", "data-act": "intro-skip" }, "Skip");
  const body = h("div", { class: "intro-body" });
  const root = h("div", { class: "intro", role: "dialog", "aria-label": "Story" }, skip, body);
  host.appendChild(root);

  const finish = (): void => {
    if (done) return;
    done = true;
    if (typing) clearInterval(typing);
    root.remove();
    onDone();
  };
  skip.onclick = finish;

  const showLine = (): void => {
    if (line >= INTRO_LINES.length) return finish();
    const L = INTRO_LINES[line];
    onCamera?.(line);
    body.replaceChildren();
    const plate = h("div", { class: `intro-plate ${L.side}` }, h("img", { class: "intro-portrait", src: L.portrait, alt: "" }), h("span", { class: "intro-name" }, L.speaker));
    const textEl = h("p", { class: "intro-text" });
    body.append(plate, textEl);
    let i = 0;
    if (typing) clearInterval(typing);
    typing = setInterval(() => {
      i++;
      textEl.textContent = L.text.slice(0, i);
      if (i >= L.text.length) {
        clearInterval(typing!);
        typing = null;
      }
    }, 22);
  };

  const advance = (): void => {
    if (typing) {
      clearInterval(typing);
      typing = null;
      const textEl = body.querySelector(".intro-text");
      if (textEl) textEl.textContent = INTRO_LINES[line].text;
      return;
    }
    line++;
    if (line >= INTRO_LINES.length) finish();
    else showLine();
  };

  root.onclick = (e) => {
    if ((e.target as HTMLElement).closest("[data-act=intro-skip]")) return;
    advance();
  };
  showLine();
  return finish;
}
