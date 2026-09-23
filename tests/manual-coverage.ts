// This project has no automated coverage for the command prototypes and
// reference tools listed below: none of them are registered with
// CommandExecutor, and each one's only real behavior is a live external
// call with nothing to assert against.
//
// Require a real WhatsApp session (whatsapp-web.js Client + LocalAuth,
// i.e. a live browser tied to a real phone number):
//   add-users, ban, clean, cooldown, join, media-to-sticker,
//   promote-demote, summary, todos
//
// Call a live third-party service directly, with no src/ tie-in at all:
//   doi        - Anna's Archive / LibGen scraping + download
//   drive      - Google Drive direct-download
//   imagine    - Bing Image Creator via the `bimg` package
//   letra      - lyrics.ovh
//   math       - local Typst compilation (not part of src/ either)
//   papers     - Semantic Scholar
//   say        - AWS Polly (needs real AWS credentials)
//   translate  - Google Translate
//   wiki       - Wikipedia
//   yt         - YouTube Data API (needs an API key)
//   yt-dlp     - shells out to the yt-dlp binary against a live URL
//
// Touch real src/ code, but only through a live dependency:
//   bing-image-test drives src/infrastructure/external/
//   bing-image-generator.ts, which needs an authenticated Bing session
//   cookie to do anything. chat is a self-contained ChatEngine prototype
//   for an AI chat feature that isn't referenced anywhere in src/ or
//   registered as a command.
//
// Testing any of these would mean faking a boundary (a browser session, a
// third-party API) that nothing else in this codebase needs faked.
