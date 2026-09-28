import type { Group } from "../../domain/group";

export class GroupAlreadyRegisteredError extends Error {
  constructor(groupId: string) {
    super(`Group already registered: ${groupId}`);
    this.name = "GroupAlreadyRegisteredError";
  }
}

export interface GroupStore {
  findByGroupId(groupId: string): Promise<Group | null>;
  findByContactNumber(contactNumber: string): Promise<Group[]>;
  // Throws GroupAlreadyRegisteredError unless the group is new or a different
  // owner is reclaiming a lapsed one.
  registerOrReactivate(
    groupId: string,
    groupName: string,
    contactNumber: string
  ): Promise<void>;
  setActive(groupId: string, isActive: boolean): Promise<void>;
}
