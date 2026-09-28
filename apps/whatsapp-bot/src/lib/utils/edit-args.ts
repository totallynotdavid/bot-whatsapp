import type { EditEffect } from "../../domain/edit-effect";

export type EditArgsError =
  | { readonly type: "wrong-avatar-count"; readonly required: number }
  | { readonly type: "min-avatar-count"; readonly required: number }
  | { readonly type: "missing-number" }
  | { readonly type: "missing-text" }
  | { readonly type: "missing-currency" }
  | { readonly type: "wrong-name-count"; readonly required: number };

export type EditArgsResult =
  | { readonly ok: true; readonly avatars: string[]; readonly extra: string[] }
  | { readonly ok: false; readonly error: EditArgsError };

// `args[0]` is always the effect name; the mention placeholders that follow
// it in the raw command text line up positionally with `mentionedUserIds`,
// so the tokens after them are whatever extra parameter the effect needs.
export function resolveEditArgs(
  effect: EditEffect,
  args: string[],
  mentionedUserIds: string[]
): EditArgsResult {
  if (effect.variableAvatars) {
    if (mentionedUserIds.length < 1) {
      return { ok: false, error: { type: "min-avatar-count", required: 1 } };
    }
  } else if (mentionedUserIds.length !== effect.avatarCount) {
    return {
      ok: false,
      error: { type: "wrong-avatar-count", required: effect.avatarCount },
    };
  }

  const avatarsUsedCount = effect.variableAvatars
    ? mentionedUserIds.length
    : effect.avatarCount;
  const avatars = mentionedUserIds.slice(0, avatarsUsedCount);
  const extraTokens = args.slice(1 + avatarsUsedCount);

  switch (effect.param.kind) {
    case "none":
      return { ok: true, avatars, extra: [] };

    case "number": {
      const value = extraTokens[0];
      if (value === undefined || !Number.isFinite(Number(value))) {
        return { ok: false, error: { type: "missing-number" } };
      }
      return { ok: true, avatars, extra: [value] };
    }

    case "text": {
      const text = extraTokens.join(" ").trim();
      if (!text) {
        return { ok: false, error: { type: "missing-text" } };
      }
      return { ok: true, avatars, extra: extraTokens };
    }

    case "currency": {
      const currency = extraTokens[0];
      if (!currency) {
        return { ok: false, error: { type: "missing-currency" } };
      }
      return { ok: true, avatars, extra: [currency] };
    }

    case "names": {
      const required = effect.param.count;
      if (
        extraTokens.length !== required ||
        extraTokens.some((token) => !token)
      ) {
        return { ok: false, error: { type: "wrong-name-count", required } };
      }
      return { ok: true, avatars, extra: extraTokens };
    }
  }
}
