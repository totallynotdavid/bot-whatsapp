import { rm } from 'fs/promises';

/**
 * Recursively removes a directory and all its contents
 */
export async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    // Ignore errors, as the directory might not exist
  }
}
