/**
 * RFC 4180 Integration Tests
 * Story 4.1 AC4: CSV RFC 4180 Compliance
 *
 * These tests use the REAL csv-writer (no mocks) to write actual CSV files,
 * then read them back to verify RFC 4180 compliance with special characters.
 * This ensures Adobe Stock CSV submissions won't be rejected.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CsvExportService } from '../src/services/csv-export.service';
import type { Metadata } from '../src/models/metadata.model';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * Parse a CSV string into rows of fields, handling RFC 4180 quoting.
 * Returns array of rows, each row is array of field values.
 */
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    }

    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      // Handle \r\n
      if (char === '\r' && i + 1 < content.length && content[i + 1] === '\n') {
        i += 2;
      } else {
        i++;
      }
    } else {
      currentField += char;
      i++;
    }
  }

  // Handle last row (no trailing newline)
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

describe('CsvExportService - RFC 4180 Integration', () => {
  let service: CsvExportService;
  let tempDir: string;

  beforeEach(async () => {
    service = new CsvExportService();
    tempDir = path.join(
      os.tmpdir(),
      `csv-rfc4180-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should correctly quote fields containing commas', async () => {
    const csvPath = path.join(tempDir, 'commas.csv');
    const metadata: Metadata[] = [
      {
        filename: 'photo,with,commas.jpg',
        title: 'Title with a comma, inside it that is long enough for fifty chars validation',
        keywords: 'word1,word2,word3,word4,word5',
        category: 1045,
      },
    ];

    await service.generateCSV(metadata, csvPath);

    const content = await fs.readFile(csvPath, 'utf-8');
    const rows = parseCSV(content);

    // Row 0 = header, Row 1 = data
    expect(rows.length).toBe(2);
    expect(rows[1][0]).toBe('photo,with,commas.jpg');
    expect(rows[1][1]).toContain('comma, inside');
  });

  it('should escape double quotes by doubling them', async () => {
    const csvPath = path.join(tempDir, 'quotes.csv');
    const metadata: Metadata[] = [
      {
        filename: 'image.jpg',
        title: 'A photo of "nature" with "dramatic" light long enough for fifty characters total',
        keywords: 'word1,word2,word3,word4,word5',
        category: 1045,
      },
    ];

    await service.generateCSV(metadata, csvPath);

    const raw = await fs.readFile(csvPath, 'utf-8');

    // RFC 4180: internal quotes must be escaped as ""
    expect(raw).toContain('""nature""');
    expect(raw).toContain('""dramatic""');

    // Parse back and verify the unescaped value
    const rows = parseCSV(raw);
    expect(rows[1][1]).toContain('"nature"');
    expect(rows[1][1]).toContain('"dramatic"');
  });

  it('should handle UTF-8 characters without corruption', async () => {
    const csvPath = path.join(tempDir, 'utf8.csv');
    const metadata: Metadata[] = [
      {
        filename: 'foto-café.jpg',
        title: 'Über den Wölken: Sonnenuntergang mit schönen Farben über dem Horizont sichtbar',
        keywords: 'café,über,straße,naïve,résumé',
        category: 1045,
      },
    ];

    await service.generateCSV(metadata, csvPath);

    const content = await fs.readFile(csvPath, 'utf-8');
    const rows = parseCSV(content);

    expect(rows[1][0]).toBe('foto-café.jpg');
    expect(rows[1][1]).toContain('Über');
    expect(rows[1][1]).toContain('schönen');
    expect(rows[1][2]).toContain('café');
    expect(rows[1][2]).toContain('résumé');
  });

  it('should produce valid header row with exact Adobe Stock column names', async () => {
    const csvPath = path.join(tempDir, 'headers.csv');
    const metadata: Metadata[] = [
      {
        filename: 'test.jpg',
        title: 'A simple test image title that is at least fifty characters long enough',
        keywords: 'test1,test2,test3,test4,test5',
        category: 1,
      },
    ];

    await service.generateCSV(metadata, csvPath);

    const content = await fs.readFile(csvPath, 'utf-8');
    const rows = parseCSV(content);

    expect(rows[0]).toEqual(['Filename', 'Title', 'Keywords', 'Category', 'Releases']);
  });

  it('should handle combined special characters in a single record', async () => {
    const csvPath = path.join(tempDir, 'combined.csv');
    const metadata: Metadata[] = [
      {
        filename: 'file "special".jpg',
        title: 'Photo: café, "art" & müsik — a fifty-plus character title for validation',
        keywords: 'café,"art",müsik,nature,landscape',
        category: 1045,
        releases: 'Model Released, Property Released',
      },
    ];

    await service.generateCSV(metadata, csvPath);

    const content = await fs.readFile(csvPath, 'utf-8');
    const rows = parseCSV(content);

    expect(rows[1][0]).toBe('file "special".jpg');
    expect(rows[1][1]).toContain('café');
    expect(rows[1][1]).toContain('"art"');
    expect(rows[1][2]).toContain('café');
    // Releases with comma should be properly quoted and parsed back
    expect(rows[1][4]).toBe('Model Released, Property Released');
  });
});
