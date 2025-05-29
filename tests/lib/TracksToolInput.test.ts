import { ContentBlock } from '../../src/resources/messages';

import { TracksToolInput } from '@anthropic-ai/sdk/lib/MessageStream';
import { TracksToolInput as BetaTracksToolInput } from '@anthropic-ai/sdk/lib/BetaMessageStream';
import { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta';

/**
 * This test ensures that our TracksToolInput type includes all content block types that have an input property.
 * If any new content block types with input properties are added, they should be added to the TracksToolInput types.
 */

describe('TracksToolInput type', () => {
  describe('Regular MessageStream', () => {
    type ContentBlockWithInput = Extract<ContentBlock, { input: unknown }>;

    it('TracksToolInput includes all content block types with input properties', () => {
      // Define a type that extracts all ContentBlock types that have an input property

      // TypeScript compile-time check: all ContentBlock types with input property
      // should be assignable to TracksToolInput
      type Test = ContentBlockWithInput extends TracksToolInput ? true : false;
      const test: Test = true;
      expect(test).toBe(true);
    });

    it('all TracksToolInput types should have an input property', () => {
      // TypeScript compile-time check: all TracksToolInput types should have
      // an input property (i.e., be assignable to ContentBlockWithInput)
      type Test2 = TracksToolInput extends ContentBlockWithInput ? true : false;
      const test2: Test2 = true;
      expect(test2).toBe(true);
    });
  });

  describe('Beta MessageStream', () => {
    type BetaContentBlockWithInput = Extract<BetaContentBlock, { input: unknown }>;

    it('TracksToolInput includes all content block types with input properties', () => {
      // Define a type that extracts all BetaContentBlock types that have an input property

      // TypeScript compile-time check: all BetaContentBlock types with input property
      // should be assignable to BetaTracksToolInput
      type Test = BetaContentBlockWithInput extends BetaTracksToolInput ? true : false;
      const test: Test = true;
      expect(test).toBe(true);
    });

    it('all BetaTracksToolInput types should have an input property', () => {
      // TypeScript compile-time check: all BetaTracksToolInput types should have
      // an input property (i.e., be assignable to BetaContentBlockWithInput)
      type Test2 = BetaTracksToolInput extends BetaContentBlockWithInput ? true : false;
      const test2: Test2 = true;
      expect(test2).toBe(true);
    });
  });
});
