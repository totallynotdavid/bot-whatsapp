export type AttendanceAction = "open" | "close";

// Phone numbers are bare digits, as the transport reports senders.
export interface AttendanceRecord {
  readonly action: AttendanceAction;
  readonly managerNumber: string;
  readonly imageUrl: string;
  readonly timestamp: Date;
}

export interface AttendanceEvent {
  readonly managerNumber: string;
  readonly timestamp: Date;
}

export interface OpeningPhoto {
  readonly managerNumber: string;
  readonly imageUrl: string;
  readonly timestamp: Date;
}

// The library is open when the last opening has no closing after it.
export function isOpen(
  lastOpening: AttendanceEvent | null,
  lastClosing: AttendanceEvent | null
): boolean {
  if (!lastOpening) return false;
  if (!lastClosing) return true;
  return lastOpening.timestamp.getTime() > lastClosing.timestamp.getTime();
}
