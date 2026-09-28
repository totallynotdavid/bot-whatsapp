import type {
  AttendanceAction,
  AttendanceEvent,
  AttendanceRecord,
  OpeningPhoto,
} from "../../domain/attendance";

export interface AttendanceStore {
  record(entry: AttendanceRecord): Promise<void>;

  // Null means nobody has done `action` yet.
  latest(action: AttendanceAction): Promise<AttendanceEvent | null>;

  openingsBetween(from: Date, to: Date): Promise<OpeningPhoto[]>;

  // Null means the number is not a registered librarian.
  librarianName(managerNumber: string): Promise<string | null>;
}
