import { PitchPipe } from "./audio.js";
import { renderNoteButtons } from "./ui.js";

const pitchPipe = new PitchPipe();
const grid = document.getElementById("note-grid");
renderNoteButtons(grid, pitchPipe);

const waveformSelect = document.getElementById("waveform-select");
waveformSelect.value = pitchPipe.waveform;
waveformSelect.addEventListener("change", () => {
  pitchPipe.setWaveform(waveformSelect.value);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
