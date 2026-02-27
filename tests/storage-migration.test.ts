/**
 * Tests for IndexedDB storage migration (B7)
 * Covers: IndexedDBStateStorage, binaryUtils, createStorageAdapter, migration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BINARY_KEYS,
  stripNodeBinaryFields,
  restoreNodeBinaryFields,
  isFileRef,
} from '../services/storage/binaryUtils';

// ─── binaryUtils ────────────────────────────────────────────────────

describe('binaryUtils', () => {
  describe('stripNodeBinaryFields', () => {
    it('strips all BINARY_KEYS from node data', () => {
      const data: Record<string, any> = {
        image: 'base64_image_data',
        images: ['img1', 'img2'],
        video: 'video_blob',
        videoUrl: 'http://example.com/v.mp4',
        audio: 'audio_blob',
        generatedEpisodes: [{ title: 'ep1' }],
        scriptOutline: 'outline',
        episodeStoryboard: { shots: [] },
        refinedContent: 'refined',
        // non-binary fields
        title: '测试节点',
        storyboardCount: 5,
      };

      const { cleaned, extracted } = stripNodeBinaryFields('node_1', data);

      // Binary keys replaced with fileRef
      for (const key of BINARY_KEYS) {
        expect(cleaned[key]).toEqual({
          __fileRef: true,
          fieldKey: key,
          nodeId: 'node_1',
        });
      }

      // Non-binary keys preserved
      expect(cleaned.title).toBe('测试节点');
      expect(cleaned.storyboardCount).toBe(5);

      // Extracted map has all binary values
      expect(extracted.size).toBe(BINARY_KEYS.length);
      expect(extracted.get('node_1::image')).toBe('base64_image_data');
      expect(extracted.get('node_1::images')).toEqual(['img1', 'img2']);
    });

    it('skips null/undefined binary fields', () => {
      const data = {
        image: null,
        video: undefined,
        title: '测试',
      };

      const { cleaned, extracted } = stripNodeBinaryFields('n1', data);

      expect(cleaned.image).toBeNull();
      expect(cleaned.video).toBeUndefined();
      expect(cleaned.title).toBe('测试');
      expect(extracted.size).toBe(0);
    });

    it('handles empty data object', () => {
      const { cleaned, extracted } = stripNodeBinaryFields('n1', {});
      expect(Object.keys(cleaned)).toHaveLength(0);
      expect(extracted.size).toBe(0);
    });
  });

  describe('restoreNodeBinaryFields', () => {
    it('restores fileRef placeholders from binary store', () => {
      const binaryStore = new Map<string, any>();
      binaryStore.set('node_1::image', 'restored_image');
      binaryStore.set('node_1::video', 'restored_video');

      const data = {
        image: { __fileRef: true, fieldKey: 'image', nodeId: 'node_1' },
        video: { __fileRef: true, fieldKey: 'video', nodeId: 'node_1' },
        title: '测试',
      };

      const restored = restoreNodeBinaryFields('node_1', data, binaryStore);

      expect(restored.image).toBe('restored_image');
      expect(restored.video).toBe('restored_video');
      expect(restored.title).toBe('测试');
    });

    it('leaves non-fileRef fields untouched', () => {
      const data = {
        image: 'already_a_string',
        title: '测试',
      };

      const restored = restoreNodeBinaryFields('n1', data, new Map());
      expect(restored.image).toBe('already_a_string');
    });
  });

  describe('isFileRef', () => {
    it('returns true for valid fileRef', () => {
      expect(isFileRef({ __fileRef: true, fieldKey: 'image', nodeId: 'n1' })).toBe(true);
    });

    it('returns false for non-fileRef values', () => {
      expect(isFileRef(null)).toBe(false);
      expect(isFileRef('string')).toBe(false);
      expect(isFileRef(42)).toBe(false);
      expect(isFileRef({ __fileRef: false })).toBe(false);
      expect(isFileRef({})).toBe(false);
    });
  });
});
