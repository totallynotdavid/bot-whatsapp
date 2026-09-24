import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import { toWhatsAppId } from "../../domain/message";
import type { EditEffect } from "../../domain/edit-effect";
import type { CommandDeps } from "../command-deps";
import type { ImageUpload } from "../ports/image-host";
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

type EditDeps = Pick<
  CommandDeps,
  "sender" | "imageHost" | "tempFiles" | "effects" | "converter"
>;

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

  constructor(private readonly deps: EditDeps) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    const effectName = context.args[0];
    if (!effectName) {
      return { type: "text", content: `Uso: /${this.metadata.usage}` };
    }

    const effect = this.deps.effects.find(effectName);
    if (!effect) {
      return {
        type: "error",
        userMessage: formatEditUnknownEffect(effectName),
      };
    }

    if (!this.deps.imageHost.isConfigured()) {
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
      const resolved = new Map<string, ImageUpload>();

      for (const phone of uniquePhones) {
        const picUrl = await this.deps.sender.getProfilePicUrl(
          toWhatsAppId(phone)
        );
        if (!picUrl) {
          throw new Error(`No profile picture available for ${phone}`);
        }

        const uploaded = await this.deps.imageHost.upload(picUrl);
        uploadedHashes.push(uploaded.deleteHash);
        resolved.set(phone, uploaded);
      }

      const avatarLinks = parsed.avatars.map(
        (phone) => resolved.get(phone)!.link
      );
      const buffer = await this.deps.effects.render(
        effect,
        avatarLinks,
        parsed.extra
      );

      if (!buffer) {
        throw new Error(`${effect.name} produced no image`);
      }

      const isGif = effect.outputFormat === "gif";
      const renderedPath = await this.deps.tempFiles.saveBuffer(
        buffer,
        isGif ? "gif" : "png"
      );
      createdFiles.push(renderedPath);

      let sendPath = renderedPath;
      if (isGif) {
        sendPath = this.deps.tempFiles.getPath("mp4");
        createdFiles.push(sendPath);
        await this.deps.converter.gifToMp4(renderedPath, sendPath);
        await this.deps.tempFiles.cleanup(renderedPath);
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
        createdFiles.map((filePath) => this.deps.tempFiles.cleanup(filePath))
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
      this.deps.imageHost.deleteImage(deleteHash).catch((error) => {
        log("warn", "Imgur cleanup failed", {
          deleteHash,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }
}
