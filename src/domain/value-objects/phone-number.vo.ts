export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(raw: string): PhoneNumber {
    const normalized = raw.replace(/[@c.us]/g, "");

    if (!/^\d{10,15}$/.test(normalized)) {
      throw new Error(`Invalid phone number: ${raw}`);
    }

    return new PhoneNumber(normalized);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toWhatsAppId(): string {
    return `${this.value}@c.us`;
  }
}
