import { DomainError } from "./domain-error";

export class ValidationError extends DomainError {
  constructor(message: string, userMessage: string) {
    super(message, "VALIDATION_ERROR", userMessage);
    this.name = "ValidationError";
  }
}
