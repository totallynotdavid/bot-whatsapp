export type EffectParam =
  | { readonly kind: "none" }
  | { readonly kind: "number" }
  | { readonly kind: "text" }
  | { readonly kind: "currency" }
  | { readonly kind: "names"; readonly count: number };

export interface EditEffect {
  readonly name: string;
  readonly avatarCount: number;
  readonly variableAvatars: boolean;
  readonly param: EffectParam;
  readonly outputFormat: "image" | "gif";
}
