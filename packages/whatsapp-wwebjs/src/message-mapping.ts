export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[@c.us]/g, "");
}
