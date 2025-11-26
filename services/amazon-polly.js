// You need to create an access key on https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/security_credentials
// These keys are stored on C:\Users\{user}\.aws\credentials or ~/.aws/credentials

const {
  PollyClient,
  SynthesizeSpeechCommand,
} = require("@aws-sdk/client-polly");

const REGION = "us-east-1";
const client = new PollyClient({ region: REGION });

const voiceOptions = {
  Ricardo: "standard",
  Conchita: "standard",
  Lucia: "neural",
  Enrique: "standard",
  Sergio: "neural",
  Mia: "neural",
  Andres: "neural",
  Lupe: "neural",
  Penelope: "neural",
  Miguel: "standard",
};

function getRandomVoice() {
  const voices = Object.keys(voiceOptions);
  return voices[Math.floor(Math.random() * voices.length)];
}

function isValidVoice(voiceId) {
  return Object.prototype.hasOwnProperty.call(voiceOptions, voiceId);
}

async function synthesizeSpeech(text, voiceId) {
  const params = {
    Text: text,
    OutputFormat: "mp3",
    VoiceId: voiceId,
    Engine: voiceOptions[voiceId],
  };

  try {
    const command = new SynthesizeSpeechCommand(params);
    const data = await client.send(command);
    return data.AudioStream;
  } catch (err) {
    console.error("Failed to synthesize speech:", err);
    throw new Error("Failed to synthesize speech");
  }
}

module.exports = {
  getRandomVoice,
  isValidVoice,
  synthesizeSpeech,
};
