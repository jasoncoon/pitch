import { NOTE_NAMES } from "./audio.js";

export function renderNoteButtons(container, pitchPipe) {
  // Keyed by pointerId so releasing one finger of a multi-note chord doesn't
  // stop the others.
  const activePointers = new Map();

  const releasePointer = (pointerId) => {
    const active = activePointers.get(pointerId);
    if (!active) return;
    activePointers.delete(pointerId);
    active.button.classList.remove("active");
    pitchPipe.noteOff(active.noteName);
  };

  for (const noteName of NOTE_NAMES) {
    const button = document.createElement("button");
    button.className = "note-button";
    button.type = "button";
    button.textContent = noteName.replace("4", "");
    button.addEventListener("contextmenu", (e) => e.preventDefault());

    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      activePointers.set(e.pointerId, { button, noteName });
      button.classList.add("active");
      pitchPipe.noteOn(noteName);
    });

    container.appendChild(button);
  }

  // Listen at the window level (rather than per-button) so a pointer that's
  // dragged off the button, or interrupted by the OS, still gets released.
  window.addEventListener("pointerup", (e) => releasePointer(e.pointerId));
  window.addEventListener("pointercancel", (e) => releasePointer(e.pointerId));
}
