export type CommandResult =
  | { type: "text"; content: string }
  | { type: "media"; path: string; caption?: string }
  | { type: "error"; message: string }
  | { type: "no-op" };
