import { Rank } from "../domain/user";

export const MESSAGES = {
  errors: {
    permissionDenied: "No tienes permiso para usar este comando.",
    internalError: "Error interno. El equipo ha sido notificado.",
    commandNotFound: "Comando no encontrado.",
    invalidArguments: "Argumentos inválidos.",
    groupOnly: "Este comando solo funciona en grupos.",
    mediaRequired: "Este comando requiere un archivo multimedia.",
    databaseError: "Error de base de datos. Intenta más tarde.",
    queueFull: "Sistema ocupado. Intenta en unos momentos.",
    mediaValidationFailed: "El medio no es válido.",
  },

  success: {
    processing: "Procesando...",
    completed: "Completado.",
    userKicked: "👋 Usuario expulsado.",
    userPromoted: "Usuario promovido a administrador.",
    premiumAdded: "Premium otorgado correctamente.",
  },

  info: {
    botOnline: "🏓 ¡Pong! El bot está en línea.",
    helpHeader: "🤖 *Comandos del bot*",
    commandDetails: "*Ayuda:*",
  },
} as const;

export function formatPermissionDenied(requiredRank: Rank): string {
  return `Este comando requiere rango ${Rank[requiredRank]} o superior.`;
}

export function formatPremiumGranted(days: number): string {
  return `${MESSAGES.success.premiumAdded}\n🌟 Se otorgaron ${days} días de premium.`;
}
