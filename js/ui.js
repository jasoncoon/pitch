import { NOTE_NAMES, NOTE_TEXT } from "./audio.js";

const NOTE_DURATION_MS = 3_000;

export function renderNoteButtons(container, pitchPipe) {
  // Keyed by button so re-tapping a still-sounding note stops it early
  // instead of stacking a second auto-stop.
  const pendingStops = new Map();

  for (let i = 0; i < NOTE_NAMES.length; i++) {
    const noteName = NOTE_NAMES[i];
    const noteText = NOTE_TEXT[i];
    const button = document.createElement("button");
    button.className = "note-button";
    button.type = "button";
    button.innerHTML = noteText;
    button.addEventListener("contextmenu", (e) => e.preventDefault());

    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();

      const pendingStop = pendingStops.get(button);
      if (pendingStop) {
        // Already playing -- tapping again stops it early instead of
        // restarting the auto-stop timer.
        clearTimeout(pendingStop);
        pendingStops.delete(button);
        button.classList.remove("active");
        pitchPipe.noteOff(noteName);
        return;
      }

      button.classList.add("active");
      pitchPipe.noteOn(noteName);

      pendingStops.set(
        button,
        setTimeout(() => {
          button.classList.remove("active");
          pitchPipe.noteOff(noteName);
          pendingStops.delete(button);
        }, NOTE_DURATION_MS)
      );
    });

    container.appendChild(button);
  }
}
