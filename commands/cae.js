const { commandGenerator, convertArrayToDict } = require(`./utilities.js`);
const CAEListCommands = require(`../data/caeListCommands.json`);
const CAEListCommandsDict = convertArrayToDict(CAEListCommands);

function codeWrapper(message) {
  return `\`\`\`` + message + `\`\`\``;
}

function getCAEMessage(
  prefix,
  stringifyMessage,
  caeCommand,
  message /*, client, Buttons*/,
  robotEmoji
) {
  try {
    //let buttonsMessage; // For now, we can't send buttons messages
    const physicsResourcesMessage = `🔗 Recursos recomendados: https://linktr.ee/caefisica\n📚 BiblioteCAE: https://bit.ly/cae_biblioteca\n📄 Guías de Estudio: https://bit.ly/41EN8CH`;

    switch (stringifyMessage.length) {
      case 1:
        /*
        buttonsMessage = new Buttons(
          '¡Aquí tienes algunos recursos adicionales para ayudarte en el estudio de la Física!', 
          [
            { body: '🔗 Recursos recomendados', url: 'https://linktr.ee/caefisica' },
            { body: '📚 BiblioteCAE', url: 'https://bit.ly/cae_biblioteca'},
          ], 
          'Guías de Estudio', 
          'Proporcionado por el equipo del Centro de Apoyo al Estudiante de Física'
        );
        client.sendMessage(message.id.remote, buttonsMessage);
        */
        message.reply(
          `🤖 ¡Aquí tienes algunos recursos adicionales para ayudarte en el estudio de la Física!\n\n${codeWrapper(
            physicsResourcesMessage
          )}\n\nProporcionado por el equipo del CAE-Física`
        );
        break;
      case 2:
        commandGenerator(
          CAEListCommandsDict,
          message,
          stringifyMessage,
          prefix,
          robotEmoji
        );
        break;
      default:
        message.reply(
          `🤖 Este comando no es válido. Usa ${prefix}${caeCommand} ayuda para ver los comandos disponibles.`
        );
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  getCAEMessage,
};
