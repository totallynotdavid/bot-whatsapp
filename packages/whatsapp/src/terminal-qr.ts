import qrcode from "qrcode-terminal";

// Draws the pairing code on stdout, not through a Logger: the payload is a
// credential, and logs are shipped and stored.
export function renderQrToTerminal(qr: string): void {
  qrcode.generate(qr, { small: true });
}
