import { DomainError } from "./domain-error";

export class PermissionError extends DomainError {
  constructor(message: string, userMessage: string) {
    super(message, "PERMISSION_DENIED", userMessage);
    this.name = "PermissionError";
  }
}
