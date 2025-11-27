import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { CONFIG_KEYS } from "./config.base.js";

const NODE_ENV = process.env.NODE_ENV || "dev";

let config;
if (NODE_ENV === "prod") {
  const configProd = await import("./config.prod.js");
  config = configProd.default;
} else {
  const configDev = await import("./config.dev.js");
  config = configDev.default;
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

export default {
  ...config,
  NODE_ENV,
};
