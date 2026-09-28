export type SpeechEngine = "standard" | "neural";

export interface Voice {
  // The Polly voice id, which is ASCII (`Andres`, not `Andrés`).
  readonly name: string;
  readonly engine: SpeechEngine;
}

// Each pair is one Polly offers for a Spanish voice, in every region that
// has the voice.
export const VOICES: readonly Voice[] = [
  { name: "Conchita", engine: "standard" },
  { name: "Lucia", engine: "neural" },
  { name: "Enrique", engine: "standard" },
  { name: "Sergio", engine: "neural" },
  { name: "Mia", engine: "neural" },
  { name: "Andres", engine: "neural" },
  { name: "Lupe", engine: "neural" },
  { name: "Penelope", engine: "standard" },
  { name: "Miguel", engine: "standard" },
];

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Ignores case and accents, so `andrés` finds Andres.
export function findVoice(name: string): Voice | undefined {
  const wanted = fold(name);
  return VOICES.find((voice) => fold(voice.name) === wanted);
}
