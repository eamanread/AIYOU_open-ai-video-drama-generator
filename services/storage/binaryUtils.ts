/**
 * Binary field stripping utilities for zustand persist.
 * Strips large binary fields (base64 images, videos, etc.) from node.data
 * before serialization, replacing them with lightweight placeholders.
 *
 * Aligned with workflowSolidifier.ts EXCLUDE_KEYS.
 */

export const BINARY_KEYS = [
  'image', 'images', 'video', 'videoUrl', 'audio',
  'generatedEpisodes', 'scriptOutline', 'episodeStoryboard', 'refinedContent',
] as const;

export interface FileRef {
  __fileRef: true;
  fieldKey: string;
  nodeId: string;
}

/**
 * Strip binary/large fields from a single node's data.
 * Returns the cleaned data and a map of extracted values.
 */
export function stripNodeBinaryFields(
  nodeId: string,
  data: Record<string, any>
): { cleaned: Record<string, any>; extracted: Map<string, any> } {
  const cleaned = { ...data };
  const extracted = new Map<string, any>();

  for (const key of BINARY_KEYS) {
    if (cleaned[key] !== undefined && cleaned[key] !== null) {
      extracted.set(`${nodeId}::${key}`, cleaned[key]);
      cleaned[key] = { __fileRef: true, fieldKey: key, nodeId } as FileRef;
    }
  }

  return { cleaned, extracted };
}

/**
 * Restore binary fields into node data from an extracted map.
 */
export function restoreNodeBinaryFields(
  nodeId: string,
  data: Record<string, any>,
  binaryStore: Map<string, any>
): Record<string, any> {
  const restored = { ...data };

  for (const key of BINARY_KEYS) {
    const ref = restored[key];
    if (ref && typeof ref === 'object' && ref.__fileRef === true) {
      const storeKey = `${nodeId}::${key}`;
      const value = binaryStore.get(storeKey);
      if (value !== undefined) {
        restored[key] = value;
      }
    }
  }

  return restored;
}

/**
 * Check if a value is a FileRef placeholder.
 */
export function isFileRef(value: unknown): value is FileRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).__fileRef === true
  );
}
