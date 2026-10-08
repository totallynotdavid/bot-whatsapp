import type { Logger, QrHandler } from "@bot-whatsapp/whatsapp";
import {
  isLoggedOut,
  manageConnection,
  type ConnectionController,
  type RawBaileysSocket,
} from "./connection";
import type { ReconnectingBaileysSocket } from "./reconnecting-socket";
import type { BaileysConnection } from "./transport";

// What the library provides once it has loaded the saved credentials.
export interface LibrarySession {
  readonly buildSocket: () => RawBaileysSocket;
  readonly saveCreds: () => void;
  readonly clearCredentials: () => Promise<void>;
}

// Joins the library to the transport's connection. disconnect() calls stop()
// before end(), so the close that end() triggers is not treated as a drop.
// A logged-out session leaves credentials the server will never accept, so
// they are cleared before the failure is reported; the restart then shows a
// QR instead of failing the same way again.
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
