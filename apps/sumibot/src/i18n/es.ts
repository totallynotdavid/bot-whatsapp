export const MESSAGES = {
  photoRequired:
    "Por favor envía una foto de la biblioteca para confirmar tu ingreso/salida.",
  opened: "¡La biblioteca se ha abierto! Gracias por tu colaboración.",
  closed: "¡La biblioteca se ha cerrado! Gracias por tu colaboración.",
  problem: "Houston, tenemos un problema.",
  libraryClosed: "La biblioteca está cerrada.",
  libraryOpen: "La biblioteca está abierta.",
  statusFailed: "Error al obtener el estado de la biblioteca",
  nobodyOpened: "Hoy nadie abrió la biblioteca.",
  reviewFailed: "Hubo un error al obtener las imágenes.",
  started: "[INICIO]",
} as const;

export function reviewPhotosFailed(captions: readonly string[]): string {
  return [
    "No se pudieron enviar estas fotos:",
    ...captions.map((caption) => `- ${caption}`),
  ].join("\n");
}

export function libraryOpenBy(name: string): string {
  return `La biblioteca está abierta. Abierto por: ${name}.`;
}
