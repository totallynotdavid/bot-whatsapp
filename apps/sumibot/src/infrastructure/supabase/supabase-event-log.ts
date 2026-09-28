import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventLog } from "../../application/ports/event-log";
import { whatsappUserKey } from "./whatsapp-user-key";

export class SupabaseEventLog implements EventLog {
  constructor(private readonly client: SupabaseClient) {}

  async commandUsed(entry: Parameters<EventLog["commandUsed"]>[0]) {
    const { error } = await this.client.from("CommandsUsage").insert([
      {
        command_id: entry.commandId,
        user_phone_number: whatsappUserKey(entry.message.senderId),
        command_name: entry.commandName,
        execution_timestamp: entry.at.toISOString(),
      },
    ]);
    if (error) {
      throw new Error(`insert into CommandsUsage: ${error.message}`);
    }
  }

  async failed(entry: Parameters<EventLog["failed"]>[0]) {
    const { error } = await this.client.from("ErrorLogs").insert([
      {
        error_message: JSON.stringify(entry.message),
        user_phone_number: whatsappUserKey(entry.message.senderId),
        error_timestamp: entry.at.toISOString(),
        additional_info:
          entry.error instanceof Error
            ? entry.error.message
            : String(entry.error),
      },
    ]);
    if (error) {
      throw new Error(`insert into ErrorLogs: ${error.message}`);
    }
  }
}
