/* IMPORTS */
const whatsappClient = require(`./functions/whatsappClient`);
const spotifyAPI = require(`./services/spotify`);
const database = require(`./lib/api/supabaseCommunicationModule.js`);

/* CHECKING */
const { checkEnvironmentVariables } = require(
  `./functions/checkEnvironmentVariables`
);
const checkStructure = require(`./functions/checkStructure`);
checkEnvironmentVariables(); // Check all envs are set before starting
checkStructure.checkFolderStructure();
checkStructure.cleanFolderStructure();
// setInterval(checkStructure.cleanFolderStructure, 1000 * 60 * 60 * 0.1); // Clean every 15 minutes

/* SUPABASE API */
const refreshData = async () => {
  const [paidUsers, physicsUsers, premiumGroups] = await Promise.all([
    database.fetchDataFromTable(`paid_users`, `phone_number`, `premium_expiry`),
    database.fetchDataFromTable(`physics_users`, `phone_number`),
    database.fetchDataFromTable(
      `premium_groups`,
      `group_id`,
      `contact_number`,
      `isActive`
    ),
  ]);

  const validPremiumUsers = paidUsers.filter(
    ({ premium_expiry }) => new Date(premium_expiry) > Date.now()
  );

  const expiredPremiumUsers = paidUsers
    .filter(({ premium_expiry }) => new Date(premium_expiry) < Date.now())
    .map(({ phone_number }) => phone_number);

  if (expiredPremiumUsers.length > 0) {
    await database.updateTable(
      `premium_groups`,
      { isActive: false },
      `contact_number`,
      expiredPremiumUsers
    );
  }

  whatsappClient.setFetchedData(validPremiumUsers, physicsUsers, premiumGroups);

  const lastCheck = new Date().toISOString();
  await database.updateTable(`app_metadata`, { lastCheck }, null, null, {
    column: `id`,
    value: 1,
  });
};

refreshData()
  .then(() => {
    const now = new Date();
    const nextFifteenMinutes = new Date(now.getTime() + 15 * 60 * 1000);
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    if (nextFifteenMinutes >= midnight) {
      setTimeout(refreshData, midnight - now);
    }
  })
  .catch(console.error);

/* SPOTIFY API */
spotifyAPI.refreshAccessToken();

/* WHATSAPP CLIENT */
whatsappClient.client.initialize();
whatsappClient.setRefreshDataCallback(refreshData); // refresh data when a new user is added
