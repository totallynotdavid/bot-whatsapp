const os = require(`os`);

const puppeteerConfig = () => {
  const platform = os.platform();

  switch (platform) {
    case `win32`:
      return {
        headless: false,
        executablePath: `C:/Users/david/AppData/Local/Google/Chrome/Application/chrome.exe`,
      };
    case `linux`:
      return {
        headless: true,
        executablePath: `/usr/bin/google-chrome-stable`,
      };
    default:
      throw new Error(`Plataforma sin soporte: ${platform}`);
  }
};

module.exports = puppeteerConfig;
