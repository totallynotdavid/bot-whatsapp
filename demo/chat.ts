// command only for paid tier users

import OpenAI from "openai";

export type IncomingMessage = {
  chatId: string;
  userId: string;
  text: string;
  timestamp: number;
  isDirectMessage: boolean;
};

type Role = "user" | "assistant";

type Turn = {
  role: Role;
  content: string;
  timestamp: number;
};

type ConversationState = {
  threadId: string;
  lastInteractionAt: number;
  turns: Turn[];
};

export interface ConversationStore {
  get(threadId: string): ConversationState | null;
  save(state: ConversationState): void;
  delete(threadId: string): void;
}

export class InMemoryConversationStore implements ConversationStore {
  private store = new Map<string, ConversationState>();

  get(threadId: string): ConversationState | null {
    return this.store.get(threadId) ?? null;
  }

  save(state: ConversationState): void {
    this.store.set(state.threadId, state);
  }

  delete(threadId: string): void {
    this.store.delete(threadId);
  }
}

type LastBotReply = {
  chatId: string;
  content: string;
  timestamp: number;
};

export interface LastBotReplyStore {
  get(chatId: string): LastBotReply | null;
  save(reply: LastBotReply): void;
}

export class InMemoryLastBotReplyStore implements LastBotReplyStore {
  private store = new Map<string, LastBotReply>();

  get(chatId: string): LastBotReply | null {
    return this.store.get(chatId) ?? null;
  }

  save(reply: LastBotReply): void {
    this.store.set(reply.chatId, reply);
  }
}

export type UserMemory = {
  preferredName?: string;
};

export interface MemoryStore {
  get(userId: string): UserMemory | null;
  save(userId: string, memory: UserMemory): void;
  delete(userId: string): void;
}

export class InMemoryMemoryStore implements MemoryStore {
  private store = new Map<string, UserMemory>();

  get(userId: string): UserMemory | null {
    return this.store.get(userId) ?? null;
  }

  save(userId: string, memory: UserMemory): void {
    this.store.set(userId, memory);
  }

  delete(userId: string): void {
    this.store.delete(userId);
  }
}

export class OpenAIChatClient {
  private client: OpenAI;
  private model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({
      apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
    });
    this.model = options?.model ?? "gpt-4o-mini";
  }

  async chat(
    messages: { role: "system" | "user" | "assistant"; content: string }[]
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }
    return content;
  }
}

const CONTEXT_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const HARD_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
const GROUP_REPLY_TIMEOUT_MS = 15 * 60 * 1000; // 15 min for group follow-ups
const CONTEXT_TOKEN_BUDGET = 800;
const LONG_MESSAGE_THRESHOLD = 500; // skip context for very long messages

const FALLBACK_ERROR_MESSAGE =
  "Hubo un problema procesando tu mensaje. Por favor, intenta de nuevo.";

// PROMPTS

const BASE_SYSTEM_PROMPT = `
Eres un asistente conversacional para WhatsApp en español.
Responde siempre en español, de forma clara, directa y útil.
No uses palabras de moda ni relleno innecesario.
Si la pregunta no es suficientemente clara, pide una aclaración breve.
`.trim();

const DM_EXTRA = `
Contexto: chat privado (DM). Puedes ser algo más conversacional.
Si conoces el nombre del usuario, úsalo de forma natural (no en cada mensaje).
`.trim();

const GROUP_EXTRA = `
Contexto: grupo de WhatsApp. Responde a la petición actual.
Si se incluye un mensaje anterior del bot como referencia, úsalo para dar continuidad.
`.trim();

// Heuristics

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function isRecentInteraction(lastAt: number, now: number, timeout: number): boolean {
  return now - lastAt <= timeout;
}

const FOLLOW_UP_STARTS = [
  "y ",
  "y ahora",
  "y qué",
  "y si",
  "además",
  "también",
  "luego",
  "después",
  "continúa",
  "continua",
  "sigue",
  "seguí",
  "con eso",
  "sobre eso",
  "respecto a eso",
  "ahora",
  "entonces",
  "añade",
  "agrega",
  "dame más",
  "más detalles",
  "explica más",
  "qué más",
];

const FOLLOW_UP_CONTAINS = [
  "como antes",
  "lo mismo pero",
  "igual que antes",
  "con lo anterior",
  "de lo anterior",
  "del anterior",
];

function hasFollowUpCue(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (FOLLOW_UP_STARTS.some((s) => t.startsWith(s))) return true;
  if (FOLLOW_UP_CONTAINS.some((s) => t.includes(s))) return true;
  return false;
}

const NEW_TOPIC_STARTS = [
  "cambiando de tema",
  "otro tema",
  "otra cosa",
  "pregunta distinta",
  "nueva pregunta",
  "nuevo tema",
  "algo diferente",
];

function hasNewTopicCue(text: string): boolean {
  const t = text.trim().toLowerCase();
  return NEW_TOPIC_STARTS.some((s) => t.startsWith(s));
}

const FORGET_NAME_CUES = [
  "olvida mi nombre",
  "olvidá mi nombre",
  "no me llames",
  "no me digas",
  "borra mi nombre",
  "elimina mi nombre",
];

function wantsToForgetName(text: string): boolean {
  const t = text.trim().toLowerCase();
  return FORGET_NAME_CUES.some((c) => t.includes(c));
}

// Name extraction with stopwords
const NAME_STOPWORDS = new Set([
  "la",
  "el",
  "un",
  "una",
  "los",
  "las",
  "unos",
  "unas",
  "mi",
  "tu",
  "su",
  "mucho",
  "mucha",
  "poco",
  "poca",
  "muy",
  "más",
  "mas",
  "menos",
  "algo",
  "nada",
  "todo",
  "toda",
  "este",
  "esta",
  "ese",
  "esa",
  "eso",
  "esto",
  "como",
  "que",
  "así",
  "asi",
  "bien",
  "mal",
  "atención",
  "atencion",
  "cuenta",
  "gracia",
  "gracias",
]);

function extractPreferredName(text: string): string | null {
  const t = text.trim();

  // Patterns: "me llamo X", "mi nombre es X", "llámame X", "soy X", "dime X", "puedes llamarme X"
  const patterns = [
    /\b(?:me llamo|mi nombre es|llámame|llamame|dime|puedes llamarme|puedes decirme)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ]*)\b/i,
    /\bsoy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/i,
  ];

  for (const re of patterns) {
    const match = t.match(re);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Check not a stopword and has reasonable length
      if (
        candidate.length >= 2 &&
        candidate.length <= 20 &&
        !NAME_STOPWORDS.has(candidate.toLowerCase())
      ) {
        // Capitalize first letter
        return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
      }
    }
  }

  return null;
}

function updateMemoryFromText(prev: UserMemory, text: string): UserMemory {
  if (wantsToForgetName(text)) {
    return {}; // clear memory
  }

  const newName = extractPreferredName(text);
  if (newName) {
    return { ...prev, preferredName: newName };
  }

  return prev;
}

export class ChatEngine {
  private convStore: ConversationStore;
  private memoryStore: MemoryStore;
  private lastBotStore: LastBotReplyStore;
  private openai: OpenAIChatClient;

  constructor(options: {
    openaiClient: OpenAIChatClient;
    conversationStore?: ConversationStore;
    memoryStore?: MemoryStore;
    lastBotReplyStore?: LastBotReplyStore;
  }) {
    this.openai = options.openaiClient;
    this.convStore = options.conversationStore ?? new InMemoryConversationStore();
    this.memoryStore = options.memoryStore ?? new InMemoryMemoryStore();
    this.lastBotStore = options.lastBotReplyStore ?? new InMemoryLastBotReplyStore();
  }

  async handleMessage(msg: IncomingMessage): Promise<string> {
    const text = msg.text?.trim();
    if (!text) {
      return "Necesito que escribas algo para poder ayudarte.";
    }

    try {
      if (msg.isDirectMessage) {
        return await this.handleDirectMessage(msg, text);
      } else {
        return await this.handleGroupMessage(msg, text);
      }
    } catch (err) {
      console.error("ChatEngine error:", err);
      return FALLBACK_ERROR_MESSAGE;
    }
  }

  /**
   * Groups: stateless with optional last-bot-reply context for follow-ups
   */
  private async handleGroupMessage(msg: IncomingMessage, text: string): Promise<string> {
    const now = Date.now();

    // Update user memory (name)
    const prevMemory = this.memoryStore.get(msg.userId) ?? {};
    const updatedMemory = updateMemoryFromText(prevMemory, text);
    if (JSON.stringify(updatedMemory) !== JSON.stringify(prevMemory)) {
      if (Object.keys(updatedMemory).length === 0) {
        this.memoryStore.delete(msg.userId);
      } else {
        this.memoryStore.save(msg.userId, updatedMemory);
      }
    }

    // Check if we should include last bot reply as context
    const lastBot = this.lastBotStore.get(msg.chatId);
    const followUpCue = hasFollowUpCue(text);
    const recentBotReply =
      lastBot && isRecentInteraction(lastBot.timestamp, now, GROUP_REPLY_TIMEOUT_MS);

    const useLastBotContext = followUpCue && recentBotReply;

    // Build messages
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

    messages.push({
      role: "system",
      content: `${BASE_SYSTEM_PROMPT}\n\n${GROUP_EXTRA}`,
    });

    if (updatedMemory.preferredName) {
      messages.push({
        role: "system",
        content: `El usuario que escribe prefiere que lo llames "${updatedMemory.preferredName}".`,
      });
    }

    if (useLastBotContext && lastBot) {
      messages.push({
        role: "assistant",
        content: lastBot.content,
      });
    }

    messages.push({ role: "user", content: text });

    // Call OpenAI
    const reply = await this.openai.chat(messages);

    // Save last bot reply for this chat
    this.lastBotStore.save({
      chatId: msg.chatId,
      content: reply,
      timestamp: now,
    });

    return reply;
  }

  private async handleDirectMessage(msg: IncomingMessage, text: string): Promise<string> {
    const now = Date.now();
    const threadId = msg.chatId;

    // Load and prune state
    let state = this.convStore.get(threadId);
    if (state && now - state.lastInteractionAt > HARD_EXPIRY_MS) {
      this.convStore.delete(threadId);
      state = null;
    }

    // Update user memory
    const prevMemory = this.memoryStore.get(msg.userId) ?? {};
    const updatedMemory = updateMemoryFromText(prevMemory, text);
    if (JSON.stringify(updatedMemory) !== JSON.stringify(prevMemory)) {
      if (Object.keys(updatedMemory).length === 0) {
        this.memoryStore.delete(msg.userId);
      } else {
        this.memoryStore.save(msg.userId, updatedMemory);
      }
    }

    // Decide if we use context
    const followUpCue = hasFollowUpCue(text);
    const newTopicCue = hasNewTopicCue(text);
    const recent = state
      ? isRecentInteraction(state.lastInteractionAt, now, CONTEXT_TIMEOUT_MS)
      : false;
    const longMessage = text.length > LONG_MESSAGE_THRESHOLD;

    let useContext = false;

    if (!state) {
      useContext = false;
    } else if (newTopicCue) {
      useContext = false; // explicit reset
    } else if (followUpCue) {
      useContext = true; // override timeout if follow-up cue
    } else if (recent && !longMessage) {
      useContext = true;
    } else {
      useContext = false;
    }

    // Build messages
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

    messages.push({
      role: "system",
      content: `${BASE_SYSTEM_PROMPT}\n\n${DM_EXTRA}`,
    });

    if (updatedMemory.preferredName) {
      messages.push({
        role: "system",
        content: `El usuario prefiere que lo llames "${updatedMemory.preferredName}".`,
      });
    }

    // Add context turns if needed
    if (useContext && state) {
      const contextTurns = this.selectTurnsWithinBudget(state.turns, CONTEXT_TOKEN_BUDGET);
      for (const turn of contextTurns) {
        messages.push({
          role: turn.role,
          content: turn.content,
        });
      }
    }

    messages.push({ role: "user", content: text });

    // Call OpenAI
    const reply = await this.openai.chat(messages);

    // Update state
    if (!state) {
      state = { threadId, lastInteractionAt: now, turns: [] };
    }

    state.turns.push(
      { role: "user", content: text, timestamp: msg.timestamp },
      { role: "assistant", content: reply, timestamp: now }
    );

    state.turns = this.trimTurnsToBudget(state.turns, CONTEXT_TOKEN_BUDGET);
    state.lastInteractionAt = now;
    this.convStore.save(state);

    return reply;
  }

  private selectTurnsWithinBudget(turns: Turn[], budget: number): Turn[] {
    const reversed = [...turns].reverse();
    const selected: Turn[] = [];
    let tokens = 0;

    for (const turn of reversed) {
      const t = estimateTokens(turn.content);
      if (tokens + t > budget) break;
      selected.push(turn);
      tokens += t;
    }

    return selected.reverse();
  }

  private trimTurnsToBudget(turns: Turn[], budget: number): Turn[] {
    return this.selectTurnsWithinBudget(turns, budget);
  }
}

/**
 * Example usage:
 *
 * const openaiClient = new OpenAIChatClient({ model: "gpt-4o-mini" });
 * const chatEngine = new ChatEngine({ openaiClient });
 *
 * const reply = await chatEngine.handleMessage({
 *   chatId: "chat-123",
 *   userId: "user-456",
 *   text: "Hola, me llamo Carlos",
 *   timestamp: Date.now(),
 *   isDirectMessage: true,
 * });
 */