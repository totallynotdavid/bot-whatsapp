# How it works

This page follows a message through the bot, then covers jobs, a lost WhatsApp
connection and shutdown. [Architecture](architecture.md) maps the code.
[Deployment](deployment.md) covers running it.

## From message to reply

1. The WhatsApp transport hands each message that starts with the command prefix
   to `MessageProcessor.process`. Other messages are not converted.
2. The processor reacts to the message with ⏳, then calls
   `CommandExecutor.execute`.
3. The executor parses the command name. A message that is not a command gets no
   reply. An unknown command gets "command not found" and up to three similar
   names.
4. It loads the sender's rank and checks it against the command's `minRank`.
5. In a group, a command that needs an active group runs only if the group is
   registered and active ([commands](commands.md#groups)).
6. The command returns a result: `text`, `media`, `sticker`, `queued`, `error`
   or `none`.
7. `ResponseBuilder` sends the result as a reply to the message. `queued` sends
   an acknowledgement, and the job sends the real reply later. An `error` is
   sent as `❌ <message>`. The ⏳ is then removed.
8. An exception inside a command is caught by `CommandExecutor`, logged, and
   answered with the internal error reply. An exception elsewhere in the
   processor goes to `ErrorHandler`, which sends the same reply and reacts with
   ❌. Both send the owner the error and the message through `OwnerNotifier`.
   The sender makes up to three attempts at each send, waiting 1 second after
   the first failure and 2 after the second. If the owner message still fails,
   the failure is logged and nothing more is sent. A failed send in step 7 is
   logged only.

## Jobs

Sticker conversion, Spotify previews and document downloads run as jobs on
BullMQ, over Redis. `/edit`, `/say` and `/tex` run inside the command.

Each job type has its own queue and worker, with its own limits:

| Job       | Concurrency | Timeout | Attempts |
| --------- | ----------- | ------- | -------- |
| `sticker` | 5           | 2 min   | 3        |
| `spotify` | 5           | 2 min   | 3        |
| `docs`    | 1           | 5 min   | 3        |

A job definition (`src/infrastructure/queue/job-definition.ts`) holds the
payload schema, the limits, the failure text and a `run` function.

1. The worker validates the payload with zod. An invalid payload fails at once,
   with no retry.
2. `run` does the work and sends the reply itself. The job is done only when
   `run` returns.
3. `run` gets an `AbortSignal` that fires at the timeout.
4. On failure, BullMQ retries with an exponential backoff that starts at 2
   seconds, until the attempts run out. A `JobRejectedError` skips the remaining
   attempts.
5. After the last attempt the user gets one reply, `❌ Error: <reason>`. The
   reason is the `JobRejectedError` message, or the definition's fixed failure
   text. The raw error never reaches the user.

BullMQ keeps the last 100 completed jobs and the last 500 failed ones.

## When WhatsApp disconnects

The two transports differ in what they recover from.

- **whatsapp-web.js** does not reconnect. A disconnect after the client is ready
  ends the session. A disconnect or an authentication failure before it is ready
  makes `connect()` fail.
- **Baileys** reconnects after any close, waiting 1 second and doubling up to 30
  seconds. The wait resets when the connection opens. Two closes are final:
  `loggedOut` (WhatsApp revoked the session) and `connectionReplaced` (another
  session took over). After `loggedOut` the saved credentials are cleared, so
  the next start shows a QR code. After `connectionReplaced` they stay.

When a session ends, the transport calls `onClose`, and the bot starts a
[shutdown](#shutdown) with exit code 1. A process supervisor then starts a new
process. [Deployment](deployment.md#restarts) sets that up.

## Shutdown

One function ends the process. The first call runs the steps once and fixes the
exit code. A later call does nothing.

- `SIGINT` and `SIGTERM` call it with code 0.
- The transport's `onClose` calls it with code 1.

The steps run in this order: stop receiving WhatsApp messages, stop the job
workers, close the job queues, close Redis, close the Anna's Archive browser,
disconnect the WhatsApp transport. Jobs in flight finish before their
connections close, because the workers stop first and the transport closes last.
A step that fails is logged and the rest still run. The process exits when the
steps end, or after 15 seconds if one never settles.

## Limits to know

- **Delivery is at-least-once.** A job that fails after it sent its reply can
  send it again on retry.
- **A send in flight cannot be cancelled.** WhatsApp calls take no signal. A
  send that started before a timeout can finish after the retry starts.
- **A stalled job cannot be answered.** If BullMQ reports a failure without the
  job, as it does for a stall, the bot has no chat to reply to and only logs it.
- **Lookups fail loudly.** A failed `/docs` search gives the internal error
  reply, not "no results".
- **Retries live in one place per path.** BullMQ retries jobs. Direct replies
  retry in the sender, and `/docs` search retries in the client that calls the
  API. A direct reply is never retried inside a job.
- **`/tex` bounds input by length, not by timeout.** The Typst compiler runs
  synchronously, so a timeout cannot interrupt it. The 4000-character limit
  bounds the compile time.
