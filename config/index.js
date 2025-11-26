const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { CONFIG_KEYS } = require("./config.base");

const NODE_ENV = process.env.NODE_ENV || "dev";

let config;
if (NODE_ENV === "prod") {
  config = require("./config.prod");
} else {
  config = require("./config.dev");
}

function validateConfig(config) {
  const missingKeys = Object.values(CONFIG_KEYS).filter(
    (key) => !(key in config)
  );
  if (missingKeys.length > 0) {
    throw new Error(`Missing configuration keys: ${missingKeys.join(", ")}`);
  }
}

validateConfig(config);

module.exports = {
  ...config,
  NODE_ENV,
};
