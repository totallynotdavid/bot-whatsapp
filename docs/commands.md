# Commands

Commands trigger on a prefix (default `/`). Each user has a rank: Regular → Premium → Owner.

## Regular

All users. In a group, these commands respond only if the group is registered and active (`/addgroup`, `/bot on`). `/subscription` and `/kick` are the exceptions. In a private chat there is no such condition. Premium and Owner commands have no such restriction.

| Command | Alias | Usage | Description |
|---------|-------|-------|-------------|
| `/help` | `h`, `ayuda` | `/help` or `/help command` | Show all commands or details for one. |
| `/subscription` | `suscripcion`, `sub` | `/subscription` | Show premium status and expiry date. |
| `/sticker` | `s`, `stiker` | Send with image/video attached or reply to one | Convert image or video to sticker. |
| `/spot` | `spotify`, `spt` | `/spot artist\|song` | Search Spotify and send a 30-second preview. **Requires:** SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET. |
| `/say` | — | `/say [-voice] text` or reply to a message with `/say` | Send the text as a Spanish voice note, then name the voice used. Text is limited to 1000 characters. `-voice` is one of Conchita, Lucia, Enrique, Sergio, Mia, Andres, Lupe, Penelope, Miguel (ignoring case and accents); an unknown voice is announced and replaced by a random one. **Requires:** AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY. |
| `/docs` | `documentos`, `libros` | `/docs search` or `/docs number` | Search and download documents from Anna's Archive. Use numbers to pick from previous results (cached per user in Redis). |
| `/edit` | — | `/edit effect @user1 @user2 [param]` | Apply meme effects to profile pictures. **Requires:** IMGUR_CLIENT_ID. Unknown effect returns error. |
| `/tex` | — | `/tex <código LaTeX>` | Render LaTeX math as a PNG image, wrapped in an `align*` environment. A `\begin{...}` in the input is refused; math is limited to 4000 characters. |
| `/kick` | `ban`, `expulsar` | Reply to a message or mention the user | Remove a user from the group. Works only in a group, and only for a WhatsApp group admin or the owner. |

Heavy (take time): sticker, spot, docs, edit, say. `/say` is the one that does not use the queue: it makes a single Amazon Polly call and replies directly.

## Premium

Users with active subscription (expiry date > now).

| Command | Alias | Usage | Description |
|---------|-------|-------|-------------|
| `/addgroup` | — | `/addgroup` | Register the current group under your number. Works only inside a group. |
| `/bot` | — | `/bot on` or `/bot off` | Enable or disable the bot in your registered group. |

## Owner

Only the number in OWNER_PHONE.

| Command | Alias | Usage | Description |
|---------|-------|-------|-------------|
| `/addpremium` | `darpremium`, `premium` | Reply with `/addpremium 30` | Grant N days of premium. |
| `/refresh` | — | `/refresh` | Clear user cache in memory. |
| `/global` | — | `/global your message` | Send a message to all active premium users. |

## Ranks

1. **Regular**: Everyone.
2. **Premium**: Users with `premium_expiry > now` in `paid_users`.
3. **Owner**: The number in OWNER_PHONE.

Rank stacking: Owner has access to Owner+Premium+Regular.
