import type { Voice } from "../../domain/voice";

export interface TextToSpeech {
  isConfigured(): boolean;
  // Resolves to the path of a temp file holding a WhatsApp voice note (Ogg
  // with Opus audio). The caller owns the file and deletes it. Every failure
  // throws, leaving no file behind.
  synthesize(text: string, voice: Voice, signal?: AbortSignal): Promise<string>;
}
