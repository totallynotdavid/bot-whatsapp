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
  readonly render: (avatars: string[], extra: string[]) => Promise<Buffer>;
}

type DigModule = typeof import("discord-image-generation");

// discord-image-generation's own entry point eagerly requires every effect
// submodule, including canvas-backed native code. Importing it only inside
// `render`, on first actual use, keeps that cost off the bot's startup path
// and off every test run that only exercises the fake effects registry.
let digModulePromise: Promise<DigModule> | undefined;
function loadDig(): Promise<DigModule> {
  digModulePromise ??= import("discord-image-generation");
  return digModulePromise;
}

function withDig(
  fn: (DIG: DigModule, avatars: string[], extra: string[]) => Promise<Buffer>
): EditEffect["render"] {
  return async (avatars, extra) => {
    const DIG = await loadDig();
    return fn(DIG, avatars, extra);
  };
}

const EFFECTS: readonly EditEffect[] = [
  {
    name: "Gay",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Gay().getImage(avatars[0]!)),
  },
  {
    name: "Greyscale",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.Greyscale().getImage(avatars[0]!)
    ),
  },
  {
    name: "Invert",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Invert().getImage(avatars[0]!)),
  },
  {
    name: "Blink",
    avatarCount: 1,
    variableAvatars: true,
    param: { kind: "number" },
    outputFormat: "gif",
    render: withDig((DIG, avatars, extra) =>
      new DIG.Blink().getImage(Number(extra[0]), ...avatars)
    ),
  },
  {
    name: "Triggered",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "gif",
    render: withDig((DIG, avatars) =>
      new DIG.Triggered().getImage(avatars[0]!)
    ),
  },
  {
    name: "Ad",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Ad().getImage(avatars[0]!)),
  },
  {
    name: "Batslap",
    avatarCount: 2,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.Batslap().getImage(avatars[0]!, avatars[1]!)
    ),
  },
  {
    name: "Beautiful",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.Beautiful().getImage(avatars[0]!)
    ),
  },
  {
    name: "Bed",
    avatarCount: 2,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.Bed().getImage(avatars[0]!, avatars[1]!)
    ),
  },
  {
    name: "Bobross",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Bobross().getImage(avatars[0]!)),
  },
  {
    name: "Clown",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Clown().getImage(avatars[0]!)),
  },
  {
    name: "ConfusedStonk",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.ConfusedStonk().getImage(avatars[0]!)
    ),
  },
  {
    name: "Deepfry",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Deepfry().getImage(avatars[0]!)),
  },
  {
    name: "Delete",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Delete().getImage(avatars[0]!)),
  },
  {
    name: "DoubleStonk",
    avatarCount: 2,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.DoubleStonk().getImage(avatars[0]!, avatars[1]!)
    ),
  },
  {
    name: "Facepalm",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Facepalm().getImage(avatars[0]!)),
  },
  {
    name: "Hitler",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Hitler().getImage(avatars[0]!)),
  },
  {
    name: "Jail",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Jail().getImage(avatars[0]!)),
  },
  {
    name: "Kiss",
    avatarCount: 2,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.Kiss().getImage(avatars[0]!, avatars[1]!)
    ),
  },
  {
    name: "LisaPresentation",
    avatarCount: 0,
    variableAvatars: false,
    param: { kind: "text" },
    outputFormat: "image",
    render: withDig((DIG, _avatars, extra) =>
      new DIG.LisaPresentation().getImage(extra.join(" "))
    ),
  },
  {
    name: "Mikkelsen",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) =>
      new DIG.Mikkelsen().getImage(avatars[0]!)
    ),
  },
  {
    name: "NotStonk",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.NotStonk().getImage(avatars[0]!)),
  },
  {
    name: "Podium",
    avatarCount: 3,
    variableAvatars: false,
    param: { kind: "names", count: 3 },
    outputFormat: "image",
    render: withDig((DIG, avatars, extra) =>
      new DIG.Podium().getImage(
        avatars[0]!,
        avatars[1]!,
        avatars[2]!,
        extra[0]!,
        extra[1]!,
        extra[2]!
      )
    ),
  },
  {
    name: "Poutine",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Poutine().getImage(avatars[0]!)),
  },
  {
    name: "Rip",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Rip().getImage(avatars[0]!)),
  },
  {
    name: "Snyder",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Snyder().getImage(avatars[0]!)),
  },
  {
    name: "Stonk",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Stonk().getImage(avatars[0]!)),
  },
  {
    name: "Trash",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: withDig((DIG, avatars) => new DIG.Trash().getImage(avatars[0]!)),
  },
  {
    name: "Wanted",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "currency" },
    outputFormat: "image",
    render: withDig((DIG, avatars, extra) =>
      new DIG.Wanted().getImage(avatars[0]!, extra[0]!)
    ),
  },
];

export const EDIT_EFFECTS: ReadonlyMap<string, EditEffect> = new Map(
  EFFECTS.map((effect) => [effect.name.toLowerCase(), effect])
);
