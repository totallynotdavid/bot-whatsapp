import baseConfig from "./config.base.js";

export default {
  ...baseConfig,
  [baseConfig.CONFIG_KEYS.COMMAND_PREFIX]: "!",
  [baseConfig.CONFIG_KEYS.ADMIN_COMMAND_PREFIX]: "@",
  [baseConfig.CONFIG_KEYS.MAX_USER_MSG_LENGTH]: 800,
  [baseConfig.CONFIG_KEYS.MAX_TOKENS]: 1200,
  [baseConfig.CONFIG_KEYS.MAX_CONVERSATION_LENGTH]: 10000,
};
