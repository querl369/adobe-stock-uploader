/**
 * Tests for PROMPT_TEXT Structure Validation
 *
 * Story 3.3: Optimized AI Prompt Engineering - AC7
 *
 * Validates that the enhanced prompt includes all required sections
 * and follows Adobe Stock metadata guidelines.
 */

import { describe, it, expect } from 'vitest';
import { PROMPT_TEXT } from '../src/prompt-text';

describe('PROMPT_TEXT Structure (AC7)', () => {
  describe('JSON Response Format (AC1)', () => {
    it('should include JSON response format section', () => {
      expect(PROMPT_TEXT).toContain('RESPONSE FORMAT');
      expect(PROMPT_TEXT).toContain('"title"');
      expect(PROMPT_TEXT).toContain('"keywords"');
      expect(PROMPT_TEXT).toContain('"category"');
    });

    it('should specify exact field types', () => {
      expect(PROMPT_TEXT).toMatch(/title.*string/i);
      expect(PROMPT_TEXT).toMatch(/keywords.*array/i);
      expect(PROMPT_TEXT).toMatch(/category.*number/i);
    });

    it('should request JSON-only response without additional text', () => {
      expect(PROMPT_TEXT).toMatch(/only.*valid.*json/i);
    });
  });

  describe('Title Requirements (AC2)', () => {
    it('should specify title length of 50-200 characters', () => {
      expect(PROMPT_TEXT).toMatch(/50[-–]?200\s*characters/i);
    });

    it('should prohibit commas in titles', () => {
      expect(PROMPT_TEXT).toMatch(/no\s*commas/i);
    });

    it('should mention WHO, WHAT, WHERE descriptors', () => {
      expect(PROMPT_TEXT).toContain('WHO');
      expect(PROMPT_TEXT).toContain('WHAT');
      expect(PROMPT_TEXT).toContain('WHERE');
    });

    it('should emphasize keyword-rich searchable titles', () => {
      expect(PROMPT_TEXT).toMatch(/keyword[-\s]?rich/i);
      expect(PROMPT_TEXT).toMatch(/search/i);
    });
  });

  describe('Keyword Requirements (AC3)', () => {
    it('should specify 30-50 keyword range (not 25)', () => {
      // Check for 30-50 range mentioned in prompt (can be in various formats)
      expect(PROMPT_TEXT).toMatch(/30[-–]?50/i);
      expect(PROMPT_TEXT).toContain('keywords');
      expect(PROMPT_TEXT).not.toMatch(/maximum of 25 keywords/i);
    });

    it('should specify minimum of 30 keywords', () => {
      expect(PROMPT_TEXT).toMatch(/minimum.*30/i);
    });

    it('should specify maximum of 50 keywords', () => {
      expect(PROMPT_TEXT).toMatch(/maximum.*50/i);
    });

    it('should include keyword diversity requirements', () => {
      // Primary subject
      expect(PROMPT_TEXT).toMatch(/primary\s*subject/i);
      // Colors and visual elements
      expect(PROMPT_TEXT).toMatch(/colors/i);
      // Mood and emotion
      expect(PROMPT_TEXT).toMatch(/mood/i);
      expect(PROMPT_TEXT).toMatch(/emotion/i);
      // Industry/use cases
      expect(PROMPT_TEXT).toMatch(/industry/i);
      // Technical descriptors
      expect(PROMPT_TEXT).toMatch(/technical/i);
    });

    it('should specify no duplicates requirement', () => {
      expect(PROMPT_TEXT).toMatch(/no\s*duplicates/i);
    });

    it('should specify ordering by relevance', () => {
      expect(PROMPT_TEXT).toMatch(/order.*relevance/i);
    });
  });

  describe('Few-Shot Examples (AC4)', () => {
    it('should include at least 2 few-shot examples', () => {
      // Count JSON example blocks with title, keywords, and category
      const exampleMatches = PROMPT_TEXT.match(/\{\s*"title":[^}]*"keywords":\s*\[[^\]]+\][^}]*"category":\s*\d+\s*\}/g);
      expect(exampleMatches).not.toBeNull();
      expect(exampleMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it('should include example for People/Business category', () => {
      // Category 3 is Business
      expect(PROMPT_TEXT).toMatch(/Example.*Business/i);
      expect(PROMPT_TEXT).toMatch(/"category":\s*3/);
    });

    it('should include example for Landscape/Nature category', () => {
      // Category 11 is Landscape
      expect(PROMPT_TEXT).toMatch(/Example.*Landscape/i);
      expect(PROMPT_TEXT).toMatch(/"category":\s*11/);
    });

    it('should demonstrate proper title formatting in examples', () => {
      // Examples should have titles without commas
      const exampleMatches = PROMPT_TEXT.match(/"title":\s*"([^"]+)"/g);
      expect(exampleMatches).not.toBeNull();
      exampleMatches!.forEach(match => {
        const titleMatch = match.match(/"title":\s*"([^"]+)"/);
        if (titleMatch) {
          expect(titleMatch[1]).not.toContain(',');
        }
      });
    });

    it('should demonstrate diverse keyword arrays in examples', () => {
      // Examples should have substantial keyword arrays (30+ keywords)
      const keywordMatches = PROMPT_TEXT.match(/"keywords":\s*\[([^\]]+)\]/g);
      expect(keywordMatches).not.toBeNull();
      keywordMatches!.forEach(match => {
        const keywords = match.match(/"([^"]+)"/g);
        if (keywords && keywords.length > 5) {
          // Example keyword arrays should have 30+ items
          expect(keywords.length).toBeGreaterThanOrEqual(30);
        }
      });
    });
  });

  describe('Commercial Stock Photography Guidance (AC5)', () => {
    it('should include commercial stock photography section', () => {
      expect(PROMPT_TEXT).toMatch(/commercial.*stock/i);
    });

    it('should mention buyer-focused language', () => {
      expect(PROMPT_TEXT).toMatch(/buyer/i);
    });

    it('should mention marketing/advertising use cases', () => {
      expect(PROMPT_TEXT).toMatch(/marketing/i);
      expect(PROMPT_TEXT).toMatch(/advertising/i);
    });

    it('should mention designers as target users', () => {
      expect(PROMPT_TEXT).toMatch(/designer/i);
    });

    it('should emphasize searchability over creativity', () => {
      expect(PROMPT_TEXT).toMatch(/searchab/i);
      expect(PROMPT_TEXT).toMatch(/practical/i);
    });

    it('should discourage overly artistic descriptions', () => {
      // Check for guidance against poetic/artistic descriptions
      expect(PROMPT_TEXT).toMatch(/poetic/i);
      expect(PROMPT_TEXT).toMatch(/artistic/i);
    });
  });

  describe('Category Selection (AC6)', () => {
    it('should list all 21 categories', () => {
      // Check for all 21 category IDs
      for (let i = 1; i <= 21; i++) {
        expect(PROMPT_TEXT).toMatch(new RegExp(`${i}\\s*[\\.\\)]?\\s*[A-Z]`));
      }
    });

    it('should explicitly request category as NUMBER', () => {
      expect(PROMPT_TEXT).toMatch(/category.*NUMBER/i);
      expect(PROMPT_TEXT).toMatch(/category.*\d+[-–]?\d*/i);
    });

    it('should provide guidance for similar category disambiguation', () => {
      // Should mention tips for choosing between similar categories
      expect(PROMPT_TEXT).toMatch(/category.*tips/i);
    });

    it('should emphasize selecting the MOST specific category', () => {
      expect(PROMPT_TEXT).toMatch(/most\s*specific/i);
    });

    it('should include category descriptions', () => {
      // Check that categories have descriptions
      expect(PROMPT_TEXT).toContain('Animals');
      expect(PROMPT_TEXT).toContain('Business');
      expect(PROMPT_TEXT).toContain('Landscape');
      expect(PROMPT_TEXT).toContain('Technology');
      expect(PROMPT_TEXT).toContain('Travel');
    });
  });

  describe('Prompt Quality Checks', () => {
    it('should be a non-empty string', () => {
      expect(typeof PROMPT_TEXT).toBe('string');
      expect(PROMPT_TEXT.length).toBeGreaterThan(0);
    });

    it('should be substantial in length (comprehensive prompt)', () => {
      // Enhanced prompt should be significantly longer than original 29 lines
      // Expecting at least 3000 characters for comprehensive coverage
      expect(PROMPT_TEXT.length).toBeGreaterThan(3000);
    });

    it('should not contain the old 25 keyword limit', () => {
      expect(PROMPT_TEXT).not.toMatch(/maximum of 25 keywords/i);
      expect(PROMPT_TEXT).not.toMatch(/25 keywords/i);
    });

    it('should not contain the old 70 character title limit', () => {
      expect(PROMPT_TEXT).not.toMatch(/70 characters or fewer/i);
    });

    it('should mention Adobe Stock', () => {
      expect(PROMPT_TEXT).toMatch(/adobe\s*stock/i);
    });
  });
});
