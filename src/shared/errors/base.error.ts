export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class PermissionError extends DomainError {
  constructor(message: string, userMessage: string) {
    super(message, "PERMISSION_DENIED", userMessage);
    this.name = "PermissionError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, userMessage: string) {
    super(message, "VALIDATION_ERROR", userMessage);
    this.name = "ValidationError";
  }
}
