const ownerNumber = process.env.ADMIN_NUMBER;
const config = require(`../config`);

let prefix = config.COMMAND_PREFIX;
let prefix_admin = config.ADMIN_COMMAND_PREFIX;
let robotEmoji = config.ROBOT_EMOJI;
let paidUsers = [];
let physicsUsers = [];
let premiumGroups = [];

// User and admin commands
const commands = {
  help: `help`,
  sticker: `sticker`,
  toimage: `toimage`,
  url: `url`,
  spot: `spot`,
  letra: `letra`,
  say: `say`,
  cae: `cae`,
  reddit: `reddit`,
  w: `w`,
  yt: `yt`,
  play: `play`,
  watch: `watch`,
  test: `test`,
  doi: `doi`,
  tex: `tex`,
  paper: `paper`,
  author: `author`,
  doc: `doc`,
  drive: `drive`,
  chat: `chat`,
  edit: `edit`,
  t: `t`,
};

const adminCommands = {
  help: `help`,
  todos: `todos`,
  ban: `ban`,
  bot: `bot`,
  del: `del`,
  join: `join`,
  addgroup: `addgroup`,
  add: `add`,
  addpremium: `addpremium`,
  refresh: `refresh`,
  promote: `promote`,
  demote: `demote`,
  close: `close`,
  open: `open`,
  chat: `chat`,
  resumen: `resumen`,
  imagine: `imagine`,
  subscription: `subscription`,
  global: `global`,
};

module.exports = {
  prefix,
  prefix_admin,
  ownerNumber,
  robotEmoji,
  paidUsers,
  physicsUsers,
  premiumGroups,
  commands,
  adminCommands,
};
