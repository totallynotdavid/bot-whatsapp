import type { WAMessageKey } from "@whiskeysockets/baileys";

export function normalizePhoneNumber(jidOrPhone: string): string {
  return jidOrPhone.replace(/@.*$/, "").replace(/\D/g, "");
}

export function toJid(phoneNumber: string): string {
  return `${normalizePhoneNumber(phoneNumber)}@s.whatsapp.net`;
}

// LID-addressed accounts put a @lid jid in key.participant/key.remoteJid and
// the phone-number jid in the matching *Alt field. Substitute it wherever a
// jid we're about to normalize is one of those two, so senderId and
// self-referencing mentions end up phone-number based like the rest of the
// app expects.
export function preferPhoneNumberJid(jid: string, key: WAMessageKey): string {
  if (jid === key.participant && key.participantAlt) return key.participantAlt;
  if (jid === key.remoteJid && key.remoteJidAlt) return key.remoteJidAlt;
  return jid;
}
