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

/** Line 2: six ashore on the first trip; forty-one comes later (LORE). */
export const INTRO_LINES: IntroLine[] = [
  { speaker: "Noon", side: "left", portrait: "/portraits/noon.webp", text: "Every island has a clock. This one is a stone needle, and I am the part of it that moves." },
  { speaker: "Nell", side: "right", portrait: "/portraits/nell.webp", text: "Six of us and a goat, ashore at last. Eight Hours to our name." },
  { speaker: "Ada", side: "left", portrait: "/portraits/ada.webp", text: "The dial keeps time like a cistern keeps rain. Live well here and it gives us back more room." },
  { speaker: "Tobias", side: "right", portrait: "/portraits/tobias.webp", text: "Nothing is free. Somebody always sends a bill." },
  { speaker: "Hesper", side: "left", portrait: "/portraits/hesper.webp", text: "Welcome, all of you. Borrow an hour whenever the evening runs short. I am only ever polite about the rest." },
  { speaker: "Noon", side: "left", portrait: "/portraits/noon.webp", text: "Keep them fed. Keep them housed. And be home before dusk." },
];

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
