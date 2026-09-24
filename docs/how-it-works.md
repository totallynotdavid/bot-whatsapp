# How it works

## From message to reply

1. whatsapp-web.js hands each incoming message to `MessageProcessor.process`.
2. The processor marks the message as being handled, then calls `CommandExecutor.execute`.
3. The executor parses the prefix and command name. A message that is not a command gets no
   reply. An unknown command gets "command not found" with similar names.
4. It loads the sender's rank and checks it against the command's `minRank`.
5. In a group, a `Regular` command runs only if the group is registered and active.
6. The command returns a result: `text`, `media`, `sticker`, `queued`, `error` or `none`.
7. `ResponseBuilder` sends the result. `queued` sends the queue acknowledgement, and the job
   sends the real reply later.
8. `BaseCommand` catches an exception inside a command, logs it and returns the internal error
   result. An exception in the executor itself (steps 2 to 5) goes to `ErrorHandler`, which
   sends the internal error reply and messages the owner the error. A failed send in step 7 is
   logged only.

## Jobs

Sticker conversion, Spotify previews and document downloads run as jobs on BullMQ, over Redis.
`/edit` runs inside the command.

Each job type has its own queue and worker, with its own limits:

| Job | Concurrency | Timeout | Attempts |
|-----|-------------|---------|----------|
| `sticker` | 5 | 2 min | 3 |
| `spotify` | 5 | 2 min | 3 |
| `docs` | 1 | 5 min | 3 |

A job definition (`src/infrastructure/queue/job-definition.ts`) holds the payload schema, the
limits, the failure text and a `run` function.

1. The worker validates the payload with zod. An invalid payload fails at once, with no retry.
2. `run` does the work and sends the reply itself. The job is done only when `run` returns.
3. `run` gets an `AbortSignal` that fires at the timeout.
4. On failure, BullMQ retries until the attempts run out. A `JobRejectedError` skips the
   remaining attempts.
5. After the last attempt the user gets one failure reply: the `JobRejectedError` message, or
   the definition's fixed failure text. The raw error never reaches the user.

## Limits to know

- **Delivery is at-least-once.** A job that fails after it sent its reply can send it again on
  retry.
- **A send in flight cannot be cancelled.** WhatsApp calls take no signal. A send that started
  before a timeout can finish after the retry starts.
- **A stalled job cannot be answered.** If BullMQ reports a stall without the job, the bot has no
  chat to reply to and only logs it.
- **The queues changed name.** Jobs still waiting in the old `media-processing` queue are dropped
  when this version deploys. Deploy when the queues are empty.
- **Lookups fail loudly.** A failed `/docs` search gives the internal error reply, not "no
  results".
- **Retries live in one place per path.** BullMQ retries jobs. Direct commands retry inside the
  client that calls the API.

## Shutdown

`lifecycle.ts` stops in order: the WhatsApp receiver, the job workers, the job queues, Redis,
then the browsers and the WhatsApp client. In-flight jobs finish before their connections close.
