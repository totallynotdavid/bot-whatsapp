import type { Logger, QrHandler } from "@bot-whatsapp/whatsapp";
import {
  isLoggedOut,
  manageConnection,
  type ConnectionController,
  type RawBaileysSocket,
} from "./connection";
import type { ReconnectingBaileysSocket } from "./reconnecting-socket";
import type { BaileysConnection } from "./transport";

export interface LibrarySession {
  readonly buildSocket: () => RawBaileysSocket;
  readonly saveCreds: () => void;
  readonly clearCredentials: () => Promise<void>;
}

// disconnect() calls stop() before end(), so the close that end() triggers is
// not treated as a drop.
export function createBaileysConnection(
  proxy: ReconnectingBaileysSocket,
  openLibrary: () => Promise<LibrarySession>,
  logger: Logger,
  onQr?: QrHandler
): BaileysConnection {
  let controller: ConnectionController | undefined;
  let closeHandler: ((error: Error) => void) | undefined;

  return {
    connect: async () => {
      const library = await openLibrary();
      const forgetIfRevoked = async (error: Error): Promise<void> => {
        if (!isLoggedOut(error)) return;
        try {
          await library.clearCredentials();
        } catch (clearError) {
          logger("error", "Could not clear revoked WhatsApp credentials", {
            error:
              clearError instanceof Error
                ? clearError.message
                : String(clearError),
          });
        }
      };

      const managed = manageConnection(
        library.buildSocket,
        proxy,
        library.saveCreds,
        logger,
        onQr,
        (error) => {
          void forgetIfRevoked(error).then(() => closeHandler?.(error));
        }
      );
      controller = managed.controller;
      return managed.connected.catch(async (error: unknown) => {
        if (error instanceof Error) await forgetIfRevoked(error);
        throw error;
      });
    },
    onClose: (handler) => {
      closeHandler = handler;
    },
    disconnect: async () => {
      controller?.stop();
      await proxy.end(undefined);
    },
  };
}
