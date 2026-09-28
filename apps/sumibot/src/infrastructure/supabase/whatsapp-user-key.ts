// The tables key people by WhatsApp user jid, not by bare phone number.
export function whatsappUserKey(phoneNumber: string): string {
  return `${phoneNumber}@s.whatsapp.net`;
}

export function phoneNumberOf(userKey: string): string {
  return userKey.replace(/@.*$/, "");
}
