import { Rank } from "../domain/user";
import type { User } from "../domain/user";
import type { Group } from "../domain/group";

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
    groupAlreadyRegistered: "Este grupo ya está registrado.",
    groupNotRegistered: "Este grupo no está registrado. Usa /addgroup primero.",
    groupSubscriptionInactive:
      "Este grupo no tiene una suscripción activa. Pide a un usuario premium que use /addgroup para activarla.",
    botInvalidAction: "Especifica on u off: /bot on",
    globalMessageRequired:
      "Proporciona el mensaje que deseas enviar: /global <mensaje>",
  },

  success: {
    processing: "Procesando...",
    completed: "Completado.",
    userKicked: "👋 Usuario expulsado.",
    userPromoted: "Usuario promovido a administrador.",
    premiumAdded: "Premium otorgado correctamente.",
    groupRegistered:
      "✅ Grupo registrado. Ya puedes usar los comandos en este grupo 🎉.\n\nUsa /help para ver la lista de comandos.",
    botOn: "🤖 El bot se ha activado para este grupo.",
    botOff: "🤖 El bot se ha desactivado para este grupo.",
    cacheRefreshed: "🔄 Caché de permisos limpiada correctamente.",
  },

  info: {
    botOnline: "🏓 ¡Pong! El bot está en línea.",
    helpHeader: "🤖 *Comandos del bot*",
    commandDetails: "*Ayuda:*",
    botAlreadyOn: "🤖 Este grupo ya tiene el bot activado.",
    botAlreadyOff: "🤖 El bot ya está desactivado para este grupo.",
    subscriptionHeader: "📋 *Información de tu suscripción*",
    noSubscription: "No tienes una suscripción premium activa.",
  },
} as const;

export function formatPermissionDenied(requiredRank: Rank): string {
  return `Este comando requiere rango ${Rank[requiredRank]} o superior.`;
}

export function formatPremiumGranted(days: number): string {
  return `${MESSAGES.success.premiumAdded}\n🌟 Se otorgaron ${days} días de premium.`;
}

export function formatGlobalBroadcastResult(
  succeeded: number,
  failed: number
): string {
  return `📢 Mensaje global enviado.\n✅ Entregado a ${succeeded} usuario(s).\n❌ Falló para ${failed} usuario(s).`;
}

export function formatSubscriptionInfo(user: User, groups: Group[]): string {
  const expiryText = user.premiumExpiresAt
    ? user.premiumExpiresAt.toLocaleDateString("es-PE")
    : "Sin fecha";

  const groupsText =
    groups.length === 0
      ? "- No hay grupos registrados actualmente"
      : groups
          .map(
            (g) => `- ${g.groupName} (${g.isActive ? "activo" : "inactivo"})`
          )
          .join("\n");

  return (
    `${MESSAGES.info.subscriptionHeader}\n\n` +
    `🗓️ Fecha de expiración: ${expiryText}\n` +
    `👥 Grupos registrados:\n${groupsText}`
  );
}
