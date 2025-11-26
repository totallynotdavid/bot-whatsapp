const { handleChatLogic } = require("../utils/chat-with-llm");
const groups = require("./admin/groups");

async function handleFreeChatCommand(senderId, groupId, query) {
  if (!query) {
    return "¿Sobre qué quieres conversar?";
  }

  const hasValidSpecialDay = await groups.hasValidSpecialDay(groupId);
  if (!hasValidSpecialDay) {
    return "Este comando está disponible solo en días especiales. Usuarios de pago pueden activarlo";
  }

  try {
    return await handleChatLogic(senderId, groupId, query);
  } catch (error) {
    console.error("Error in handleFreeChatCommand:", error);
    return "Ocurrió un error al procesar tu solicitud.";
  }
}

module.exports = {
  handleFreeChatCommand,
};
