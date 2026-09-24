import ffmpeg from "fluent-ffmpeg";
import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import { toWhatsAppId } from "../../domain/message";
import type { WhatsAppSender } from "../../infrastructure/whatsapp/sender";
import type {
  ImgurClient,
  ImgurUpload,
} from "../../infrastructure/external/imgur-client";
import type { TempFileStore } from "../../infrastructure/storage/temp-file-store";
import { EDIT_EFFECTS } from "../../infrastructure/external/dig-effects";
import type { EditEffect } from "../../infrastructure/external/dig-effects";
import { resolveEditArgs } from "../../lib/utils/edit-args";
import type { EditArgsError } from "../../lib/utils/edit-args";
import {
  MESSAGES,
  formatEditUnknownEffect,
  formatEditWrongAvatarCount,
  formatEditMinAvatarCount,
  formatEditMissingNumber,
  formatEditMissingText,
  formatEditMissingCurrency,
  formatEditWrongNameCount,
  formatEditCaption,
} from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export type GifToMp4Converter = (
  inputPath: string,
  outputPath: string
) => Promise<void>;

export function convertGifToMp4(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-movflags", "faststart"])
      .toFormat("mp4")
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputPath);
  });
}

export class EditCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "edit",
    aliases: [],
    minRank: Rank.REGULAR,
    description:
      "Aplica un efecto de meme a la foto de perfil de los usuarios mencionados",
    usage: "edit <efecto> @mención1 @mención2... [parámetro]",
    isHeavyOperation: true,
  };

  constructor(
    private readonly sender: WhatsAppSender,
    private readonly imgurClient: ImgurClient,
    private readonly tempFileStore: TempFileStore,
    private readonly effects: ReadonlyMap<string, EditEffect> = EDIT_EFFECTS,
    private readonly convertGif: GifToMp4Converter = convertGifToMp4
  ) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    const effectName = context.args[0];
    if (!effectName) {
      return { type: "text", content: `Uso: /${this.metadata.usage}` };
    }

    const effect = this.effects.get(effectName.toLowerCase());
    if (!effect) {
      return {
        type: "error",
        userMessage: formatEditUnknownEffect(effectName),
      };
    }

    if (!this.imgurClient.isConfigured()) {
      return { type: "error", userMessage: MESSAGES.errors.editUnavailable };
    }

    const parsed = resolveEditArgs(
      effect,
      context.args,
      context.message.mentionedUserIds
    );
    if (!parsed.ok) {
      return {
        type: "error",
        userMessage: this.formatArgsError(effect, parsed.error),
      };
    }

    const uploadedHashes: string[] = [];
    const createdFiles: string[] = [];

    try {
      const uniquePhones = [...new Set(parsed.avatars)];
      const resolved = new Map<string, ImgurUpload>();

      for (const phone of uniquePhones) {
        const picUrl = await this.sender.getProfilePicUrl(toWhatsAppId(phone));
        if (!picUrl) {
          throw new Error(`No profile picture available for ${phone}`);
        }

        const uploaded = await this.imgurClient.upload(picUrl);
        uploadedHashes.push(uploaded.deleteHash);
        resolved.set(phone, uploaded);
      }

      const avatarLinks = parsed.avatars.map(
        (phone) => resolved.get(phone)!.link
      );
      const buffer = await effect.render(avatarLinks, parsed.extra);

      if (!buffer) {
        throw new Error(`${effect.name} produced no image`);
      }

      const isGif = effect.outputFormat === "gif";
      const renderedPath = await this.tempFileStore.saveBuffer(
        buffer,
        isGif ? "gif" : "png"
      );
      createdFiles.push(renderedPath);

      let sendPath = renderedPath;
      if (isGif) {
        sendPath = this.tempFileStore.getPath("mp4");
        createdFiles.push(sendPath);
        await this.convertGif(renderedPath, sendPath);
        await this.tempFileStore.cleanup(renderedPath);
      }

      return {
        type: "media",
        filePath: sendPath,
        caption: formatEditCaption(isGif),
        sendVideoAsGif: isGif,
        deleteAfterSend: true,
      };
    } catch (error) {
      log("error", "Edit command pipeline failed", {
        effect: effect.name,
        error: error instanceof Error ? error.message : String(error),
      });

      await Promise.all(
        createdFiles.map((filePath) => this.tempFileStore.cleanup(filePath))
      );
      return {
        type: "error",
        userMessage: MESSAGES.errors.editProcessingFailed,
      };
    } finally {
      this.cleanupImgurUploads(uploadedHashes);
    }
  }

  private formatArgsError(effect: EditEffect, error: EditArgsError): string {
    switch (error.type) {
      case "wrong-avatar-count":
        return formatEditWrongAvatarCount(effect.name, error.required);
      case "min-avatar-count":
        return formatEditMinAvatarCount(effect.name);
      case "missing-number":
        return formatEditMissingNumber(effect.name);
      case "missing-text":
        return formatEditMissingText(effect.name);
      case "missing-currency":
        return formatEditMissingCurrency(effect.name);
      case "wrong-name-count":
        return formatEditWrongNameCount(effect.name, error.required);
    }
  }

  private cleanupImgurUploads(deleteHashes: string[]): void {
    for (const deleteHash of deleteHashes) {
      this.imgurClient.deleteImage(deleteHash).catch((error) => {
        log("warn", "Imgur cleanup failed", {
          deleteHash,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }
}
