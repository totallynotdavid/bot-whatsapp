/* This runs when spotifyAPI is called */
const dotenv = require(`dotenv`);

function checkEnvironmentVariables() {
  // Check if the dotenv package is installed and the .env file exists
  if (dotenv.config().error) {
    throw new Error(
      `The dotenv package is not installed or the .env file does not exist`
    );
  }

  // Define the required environment variables
  const requiredVariables = [
    `SPOTIFY_CLIENT_ID`,
    `SPOTIFY_CLIENT_SECRET`,
    `YOUTUBE_API_KEY_1`,
    `SUPABASE_API_KEY`,
    `SUPABASE_BASE_URL`,
    `DRIVE_FOLDER_ID`,
    `FACEBOOK_ACCESS_TOKEN`,
    `FACEBOOK_PAGE_ID`,
    `ADMIN_NUMBER`,
    `OPENAI_API_KEY`,
  ];

  // Check if all of the required environment variables are defined in the .env file
  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(
        `One or more required environment variables are missing from the .env file`
      );
    }
  }
}

module.exports = {
  checkEnvironmentVariables,
};
