# Commands

A message that starts with the command prefix (`/` by default, see
[configuration](configuration.md)) runs a command. Names and aliases ignore
case. The bot's replies are in Spanish. An unknown name gets a reply with up to
three similar commands.

`/help` lists the commands your rank can run. `/help tex` shows one command's
usage and minimum rank.

## Ranks

| Rank    | Who                                                              |
| ------- | ---------------------------------------------------------------- |
| Regular | Everyone.                                                        |
| Premium | A user in `paid_users` whose `premium_expiry` is later than now. |
| Owner   | The number in `OWNER_PHONE`.                                     |

Each rank can run its own commands and those of the ranks below it.
[Database](database.md) describes `paid_users`.

## Groups

In a private chat every command your rank allows runs. In a group, a Regular
command runs only if the group is registered and active: a Premium user runs
`/addgroup` and then `/bot on` there. `/kick` and `/subscription` skip that
check. Premium and Owner commands never need it.

## Regular commands

| Command         | Aliases                | Usage                                            |
| --------------- | ---------------------- | ------------------------------------------------ |
| `/help`         | `h`, `ayuda`           | `/help` or `/help <command>`                     |
| `/subscription` | `suscripcion`, `sub`   | `/subscription`                                  |
| `/sticker`      | `s`, `stiker`          | `/sticker` with an image or video, or as a reply |
| `/spot`         | `spotify`, `spt`       | `/spot <artist or song>`                         |
| `/say`          |                        | `/say [-voice] <text>`, or `/say` as a reply     |
| `/docs`         | `documentos`, `libros` | `/docs <search>`, then `/docs <number>`          |
| `/edit`         |                        | `/edit <effect> @user1 @user2 ... [parameter]`   |
| `/tex`          |                        | `/tex <LaTeX>`                                   |
| `/kick`         | `ban`, `expulsar`      | `/kick` as a reply, or `/kick @user`             |

- `/subscription` shows when your premium ends and the groups registered under
  your number. Without active premium it says so.
- `/sticker` turns an image (JPEG, PNG, WebP) or a video (MP4, WebM) of up to 10
  MB into a sticker. It replies at once and sends the sticker when the job
  finishes.
- `/spot` searches Spotify and sends the track's 30-second preview. It needs
  `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
- `/say` sends the text as a Spanish voice note, then names the voice. The text
  is at most 1000 characters. `-voice` is one of Conchita, Lucia, Enrique,
  Sergio, Mia, Andres, Lupe, Penelope or Miguel, ignoring case and accents. With
  no voice the bot picks a random one. With an unknown voice it says the voice
  is invalid and picks a random one. It needs `AWS_ACCESS_KEY_ID` and
  `AWS_SECRET_ACCESS_KEY`. It calls Amazon Polly once.
- `/docs` searches Anna's Archive and lists up to five results. `/docs 2`
  downloads the second one. The list is kept for 10 minutes per user, and a
  download clears it.
- `/edit` applies a meme effect to the profile pictures of the users you
  mention. It needs `IMGUR_CLIENT_ID`. [Effects](#edit-effects) lists them.
- `/tex` renders LaTeX math as a PNG. The bot wraps your input in an `align*`
  environment, so `/tex x &= 1 \\ y &= 2` aligns on `&`. The input is at most
  4000 characters. Environments inside it work when the renderer supports them
  (`pmatrix`, `cases`, `aligned`, `align*`). `document`, an unknown environment
  or invalid LaTeX gets the reply "Hubo un error al procesar el código LaTeX."
- `/kick` removes a user from the group. It works only in a group, only for a
  WhatsApp group admin or the owner, and only if the bot is an admin too.

`/sticker`, `/spot` and a `/docs` download answer at once and finish as
[jobs](how-it-works.md#jobs). `/say`, `/tex`, `/edit` and a `/docs` search do
their work before they reply.

### Edit effects

An effect name ignores case. The mentions come right after it, and the parameter
after the mentions.

| Mentions  | Effects                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Gay, Greyscale, Invert, Triggered, Ad, Beautiful, Bobross, Clown, ConfusedStonk, Deepfry, Delete, Facepalm, Hitler, Jail, Mikkelsen, NotStonk, Poutine, Rip, Snyder, Stonk, Trash |
| 2         | Batslap, Bed, DoubleStonk, Kiss                                                                                                                                                   |
| 3         | Podium, plus three names after the mentions                                                                                                                                       |
| 1 or more | Blink, plus a number of frames after the mentions (a GIF)                                                                                                                         |
| 1         | Wanted, plus a currency after the mention, for example `USD`                                                                                                                      |
| 0         | LisaPresentation, plus the text to show                                                                                                                                           |

Blink and Triggered reply with a GIF. The other effects reply with an image.

## Premium commands

| Command     | Usage                   | Does                                                        |
| ----------- | ----------------------- | ----------------------------------------------------------- |
| `/addgroup` | `/addgroup`             | Registers the current group under your number. Groups only. |
| `/bot`      | `/bot on` or `/bot off` | Turns the bot on or off in a group. Groups only.            |

`/addgroup` fails for a group that is already registered, unless the group is
inactive and a different user registers it. Only the user who registered a
group, or the owner, can turn the bot on or off there.

## Owner commands

| Command       | Aliases                 | Usage                                              | Does                                          |
| ------------- | ----------------------- | -------------------------------------------------- | --------------------------------------------- |
| `/addpremium` | `darpremium`, `premium` | `/addpremium <days>` as a reply, or with a mention | Sets premium to end that many days from now.  |
| `/refresh`    |                         | `/refresh`                                         | Clears the in-memory user cache.              |
| `/global`     |                         | `/global <message>`                                | Sends a message to every active premium user. |

`/global` sends one message every 5 seconds, to keep under WhatsApp's limit for
bulk messages. It replies with how many sends succeeded and how many failed.
