/**
 * Batch Persistence Service
 * Story 4.3: Batch History Persistence (AC1, AC5)
 *
 * Persists completed batches to SQLite for history retrieval
 * beyond server restarts and in-memory expiry.
 * Uses better-sqlite3 for synchronous, zero-config persistence.
 *
 * This is a write-behind cache — BatchTrackingService remains
 * the primary source for active batches.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '@utils/logger';
import { config } from '@config/app.config';
import type { BatchState } from '@/models/batch.model';

/** Row shape returned by SQLite queries */
export interface BatchRow {
  batch_id: string;
  session_id: string;
  user_id: string | null;
  image_count: number;
  successful_count: number;
  failed_count: number;
  status: string;
  csv_filename: string | null;
  csv_path: string | null;
  created_at: string;
  completed_at: string;
  expires_at: string;
}

/** Anonymous batch expiry: 24 hours */
const ANONYMOUS_EXPIRY_MS = 24 * 60 * 60 * 1000;

export class BatchPersistenceService {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? config.database.path;
  }

  /**
   * Initialize the database — create file, table, and indexes.
   * Does NOT throw on failure (graceful degradation).
   */
  initialize(): void {
    try {
      // Ensure parent directory exists (unless :memory:)
      if (this.dbPath !== ':memory:') {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrent read performance
      this.db.pragma('journal_mode = WAL');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS processing_batches (
          batch_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          user_id TEXT,
          image_count INTEGER NOT NULL,
          successful_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
          csv_filename TEXT,
          csv_path TEXT,
          created_at TEXT NOT NULL,
          completed_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_session_id ON processing_batches(session_id);
        CREATE INDEX IF NOT EXISTS idx_expires_at ON processing_batches(expires_at);
      `);

      this.initialized = true;
      logger.info({ dbPath: this.dbPath }, 'BatchPersistenceService initialized');
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown', dbPath: this.dbPath },
        'BatchPersistenceService initialization failed — falling back to in-memory only'
      );
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Persist a completed/failed batch to the database.
   */
  persistBatch(batch: BatchState): void {
    if (!this.db) return;

    const expiresAt = new Date(batch.createdAt.getTime() + ANONYMOUS_EXPIRY_MS);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO processing_batches
        (batch_id, session_id, user_id, image_count, successful_count, failed_count,
         status, csv_filename, csv_path, created_at, completed_at, expires_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      batch.batchId,
      batch.sessionId,
      batch.userId ?? null,
      batch.progress.total,
      batch.progress.completed - batch.progress.failed, // successful only (completed includes both)
      batch.progress.failed,
      batch.status,
      batch.csvFileName ?? null,
      batch.csvPath ?? null,
      batch.createdAt.toISOString(),
      (batch.completedAt ?? new Date()).toISOString(),
      expiresAt.toISOString()
    );

    logger.info({ batchId: batch.batchId, status: batch.status }, 'Batch persisted to database');
  }

  /**
   * Get batches for a session, ordered by created_at DESC.
   * Only returns non-expired batches.
   */
  getBatchesBySession(sessionId: string, limit: number = 10): BatchRow[] {
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM processing_batches
      WHERE session_id = ? AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(sessionId, new Date().toISOString(), limit) as BatchRow[];
  }

  /**
   * Get a single batch by ID.
   * By default, excludes expired batches. Pass includeExpired=true to return all.
   */
  getBatchById(batchId: string, includeExpired: boolean = false): BatchRow | null {
    if (!this.db) return null;

    if (includeExpired) {
      const stmt = this.db.prepare('SELECT * FROM processing_batches WHERE batch_id = ?');
      return (stmt.get(batchId) as BatchRow) ?? null;
    }

    const stmt = this.db.prepare(
      'SELECT * FROM processing_batches WHERE batch_id = ? AND expires_at > ?'
    );
    return (stmt.get(batchId, new Date().toISOString()) as BatchRow) ?? null;
  }

  /**
   * Check if a batch is owned by a given session.
   */
  isBatchOwnedBySession(batchId: string, sessionId: string): boolean {
    if (!this.db) return false;

    const stmt = this.db.prepare(
      'SELECT 1 FROM processing_batches WHERE batch_id = ? AND session_id = ?'
    );
    return stmt.get(batchId, sessionId) !== undefined;
  }

  /**
   * Get expired batches without deleting them (for CSV file cleanup first).
   */
  getExpiredBatches(): BatchRow[] {
    if (!this.db) return [];

    const now = new Date().toISOString();
    const stmt = this.db.prepare('SELECT * FROM processing_batches WHERE expires_at < ?');
    return stmt.all(now) as BatchRow[];
  }

  /**
   * Delete expired batch records from the database.
   * Call this AFTER cleaning up associated CSV files to avoid orphans.
   */
  deleteExpiredBatches(): number {
    if (!this.db) return 0;

    const now = new Date().toISOString();
    const stmt = this.db.prepare('DELETE FROM processing_batches WHERE expires_at < ?');
    const result = stmt.run(now);
    return result.changes;
  }

  /**
   * Update CSV info for a persisted batch.
   * Called when CSV is generated after batch completion.
   */
  updateCsvInfo(batchId: string, csvPath: string, csvFileName: string): void {
    if (!this.db) return;

    const stmt = this.db.prepare(
      'UPDATE processing_batches SET csv_path = ?, csv_filename = ? WHERE batch_id = ?'
    );
    stmt.run(csvPath, csvFileName, batchId);
  }

  /** Whether the service initialized successfully */
  get isAvailable(): boolean {
    return this.initialized && this.db !== null;
  }

  /**
   * Close the database connection gracefully.
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore close errors
      }
      this.db = null;
      this.initialized = false;
    }
  }
}
