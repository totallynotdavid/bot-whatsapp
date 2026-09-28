import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AttendanceAction,
  AttendanceEvent,
  AttendanceRecord,
  OpeningPhoto,
} from "../../domain/attendance";
import type { AttendanceStore } from "../../application/ports/attendance-store";
import { phoneNumberOf, whatsappUserKey } from "./whatsapp-user-key";

interface AttendanceRow {
  timestamp: string;
  managerNumber: string;
  imageUrl: string;
}

function check(error: { message: string } | null, operation: string): void {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
}

export class SupabaseAttendanceStore implements AttendanceStore {
  constructor(private readonly client: SupabaseClient) {}

  async record(entry: AttendanceRecord): Promise<void> {
    const { error } = await this.client.from("libraryAttendance").insert([
      {
        timestamp: entry.timestamp.toISOString(),
        action: entry.action,
        managerNumber: whatsappUserKey(entry.managerNumber),
        imageUrl: entry.imageUrl,
      },
    ]);
    check(error, "insert into libraryAttendance");
  }

  async latest(action: AttendanceAction): Promise<AttendanceEvent | null> {
    const { data, error } = await this.client
      .from("libraryAttendance")
      .select("timestamp, managerNumber")
      .eq("action", action)
      .order("timestamp", { ascending: false })
      .limit(1);
    check(error, `read the last ${action} from libraryAttendance`);

    const row = (data as AttendanceRow[] | null)?.[0];
    return row
      ? {
          managerNumber: phoneNumberOf(row.managerNumber),
          timestamp: new Date(row.timestamp),
        }
      : null;
  }

  async openingsBetween(from: Date, to: Date): Promise<OpeningPhoto[]> {
    const { data, error } = await this.client
      .from("libraryAttendance")
      .select("imageUrl, timestamp, managerNumber")
      .eq("action", "open")
      .gte("timestamp", from.toISOString())
      .lte("timestamp", to.toISOString())
      .order("timestamp", { ascending: true });
    check(error, "read openings from libraryAttendance");

    return ((data as AttendanceRow[] | null) ?? []).map((row) => ({
      managerNumber: phoneNumberOf(row.managerNumber),
      imageUrl: row.imageUrl,
      timestamp: new Date(row.timestamp),
    }));
  }

  async librarianName(managerNumber: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("librarians")
      .select("fullName")
      .eq("managerNumber", whatsappUserKey(managerNumber))
      .maybeSingle();
    check(error, "read the librarian from librarians");

    return (data as { fullName: string } | null)?.fullName ?? null;
  }
}
