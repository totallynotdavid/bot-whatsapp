import { describe, expect, test } from "vitest";
import { SayCommand } from "../src/application/commands/say-command";
import type { TextToSpeech } from "../src/application/ports/text-to-speech";
import { VOICES, findVoice, type Voice } from "../src/domain/voice";
import { MESSAGES } from "../src/i18n/es";
import { REGULAR_PHONE, dm, makeBot } from "./fixtures";

const AUDIO_PATH = "/tmp/fake-voice-note.ogg";

class FakeTextToSpeech implements TextToSpeech {
  readonly calls: { text: string; voice: Voice }[] = [];
  configured = true;
  failing = false;

  isConfigured(): boolean {
    return this.configured;
  }

  async synthesize(text: string, voice: Voice): Promise<string> {
    if (this.failing) throw new Error("simulated polly failure");
    this.calls.push({ text, voice });
    return AUDIO_PATH;
  }
}

function setup() {
  const speech = new FakeTextToSpeech();
  const bot = makeBot(() => [new SayCommand({ speech })]);
  return { ...bot, speech };
}

const USAGE = {
  type: "text",
  content: "Uso: /say [-voz] <texto> (o responde a un mensaje)",
};

function voiceNote(followUpText: string) {
  return {
    type: "media",
    filePath: AUDIO_PATH,
    sendAudioAsVoice: true,
    deleteAfterSend: true,
    followUpText,
  };
}

describe("/say command", () => {
  test("an explicit voice returns a voice note that names the voice", async () => {
    const { executor, speech } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/say -Sergio hola  mundo")
    );

    expect(speech.calls).toEqual([
      { text: "hola mundo", voice: { name: "Sergio", engine: "neural" } },
    ]);
    expect(result).toEqual(voiceNote("Voz utilizada: Sergio"));
  });

  test("the voice name ignores case and accents", async () => {
    const { executor, speech } = setup();

    await executor.execute(dm(REGULAR_PHONE, "/say -ANDRÉS hola"));

    expect(speech.calls[0]!.voice).toEqual({
      name: "Andres",
      engine: "neural",
    });
  });

  test("an unknown voice is announced and replaced by a random one", async () => {
    const { executor, speech } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/say -Ricardo hola")
    );

    const voice = speech.calls[0]!.voice;
    expect(VOICES).toContainEqual(voice);
    expect(result).toEqual(
      voiceNote(
        `Voz inválida. Usando voz aleatoria.\nVoz utilizada: ${voice.name}`
      )
    );
  });

  test("without a voice flag a random voice speaks the whole text", async () => {
    const { executor, speech } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/say buenos días")
    );

    expect(speech.calls[0]!.text).toBe("buenos días");
    expect(result).toEqual(
      voiceNote(`Voz utilizada: ${speech.calls[0]!.voice.name}`)
    );
  });

  test("with no arguments it speaks the quoted message", async () => {
    const { executor, speech } = setup();

    await executor.execute(
      dm(REGULAR_PHONE, "/say -Lupe", {
        quotedMessageId: "quoted-1",
        quotedBody: "texto citado",
      })
    );

    expect(speech.calls).toEqual([
      { text: "texto citado", voice: { name: "Lupe", engine: "neural" } },
    ]);
  });

  test("arguments win over a quoted message", async () => {
    const { executor, speech } = setup();

    await executor.execute(
      dm(REGULAR_PHONE, "/say hola", { quotedBody: "texto citado" })
    );

    expect(speech.calls[0]!.text).toBe("hola");
  });

  test("text over 1000 characters is refused before any synthesis", async () => {
    const { executor, speech } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/say ${"a".repeat(1001)}`)
    );

    expect(result).toEqual({
      type: "error",
      userMessage: "Texto demasiado largo. Límite: 1000 caracteres.",
    });
    expect(speech.calls).toEqual([]);
  });

  test("exactly 1000 characters is accepted", async () => {
    const { executor, speech } = setup();

    await executor.execute(dm(REGULAR_PHONE, `/say ${"a".repeat(1000)}`));

    expect(speech.calls).toHaveLength(1);
  });

  test("without text or a quoted message it shows the usage", async () => {
    const { executor, speech } = setup();

    expect(await executor.execute(dm(REGULAR_PHONE, "/say"))).toEqual(USAGE);
    expect(await executor.execute(dm(REGULAR_PHONE, "/say -Sergio"))).toEqual(
      USAGE
    );
    expect(speech.calls).toEqual([]);
  });

  test("without AWS credentials it replies that the command is unavailable", async () => {
    const { executor, speech } = setup();
    speech.configured = false;

    const result = await executor.execute(dm(REGULAR_PHONE, "/say hola"));

    expect(result).toEqual({
      type: "error",
      userMessage: "El comando /say no está disponible en este momento.",
    });
    expect(speech.calls).toEqual([]);
  });

  test("a synthesis failure gives the internal-error reply", async () => {
    const { executor, speech } = setup();
    speech.failing = true;

    const result = await executor.execute(dm(REGULAR_PHONE, "/say hola"));

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.internalError,
    });
  });
});

describe("voice catalog", () => {
  test("every voice is a Spanish Polly voice; Ricardo, a Portuguese one, is not offered", () => {
    expect(VOICES.map((voice) => voice.name)).not.toContain("Ricardo");
    expect(findVoice("penélope")).toEqual({
      name: "Penelope",
      engine: "standard",
    });
  });
});
