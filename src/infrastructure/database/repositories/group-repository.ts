import {
  GroupAlreadyRegisteredError,
  type GroupStore,
} from "../../../application/ports/group-store";
import type { Group } from "../../../domain/group";
import type { PostgresClient } from "../postgres";
import { log } from "../../../lib/logging/logger";

interface GroupRow {
  group_id: string;
  group_name: string;
  contact_number: string;
  isActive: boolean;
}

const TABLE_NAME = "premium_groups";
const CONFLICT_COLUMN = "group_id";

export class GroupRepository implements GroupStore {
  constructor(private readonly postgres: PostgresClient) {}

  async findByGroupId(groupId: string): Promise<Group | null> {
    try {
      const row = await this.postgres.queryOne<GroupRow>(
        TABLE_NAME,
        "group_id, group_name, contact_number, isActive",
        { column: "group_id", value: groupId }
      );

      if (!row) {
        return null;
      }

      return this.toGroup(row);
    } catch (error) {
      log("warn", "Failed to load group from Postgres", {
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async findByContactNumber(contactNumber: string): Promise<Group[]> {
    try {
      const rows = await this.postgres.queryMany<GroupRow>(
        TABLE_NAME,
        "group_id, group_name, contact_number, isActive",
        { column: "contact_number", value: contactNumber }
      );

      return rows.map((row) => this.toGroup(row));
    } catch (error) {
      log("warn", "Failed to load groups from Postgres", {
        contactNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Reactivates only when a different owner reclaims a lapsed group.
  async registerOrReactivate(
    groupId: string,
    groupName: string,
    contactNumber: string
  ): Promise<void> {
    const existing = await this.findByGroupId(groupId);

    const isReactivationByNewOwner =
      existing !== null &&
      existing.contactNumber !== contactNumber &&
      !existing.isActive;

    if (existing && !isReactivationByNewOwner) {
      throw new GroupAlreadyRegisteredError(groupId);
    }

    try {
      await this.postgres.upsert(
        TABLE_NAME,
        {
          group_id: groupId,
          group_name: groupName,
          contact_number: contactNumber,
          isActive: true,
        },
        CONFLICT_COLUMN
      );
    } catch (error) {
      log("error", "Failed to register group in Postgres", {
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async setActive(groupId: string, isActive: boolean): Promise<void> {
    try {
      await this.postgres.update(
        TABLE_NAME,
        { isActive },
        { column: "group_id", value: groupId }
      );
    } catch (error) {
      log("error", "Failed to update group active status in Postgres", {
        groupId,
        isActive,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private toGroup(row: GroupRow): Group {
    return {
      groupId: row.group_id,
      groupName: row.group_name,
      contactNumber: row.contact_number,
      isActive: row.isActive,
    };
  }
}
