/**
 * Storage abstraction. The application depends only on this contract, so the
 * underlying driver (local filesystem, S3, Azure Blob, GCS, ...) can be swapped
 * without touching business logic.
 */
export interface StorageService {
  /**
   * Persist a binary file and return the storage key (relative path / object key)
   * that can later be used to read or delete it.
   */
  save(key: string, data: Buffer): Promise<string>;

  /** Read a previously stored file by its key. */
  read(key: string): Promise<Buffer>;

  /** Delete a stored file by its key. Must not throw if the file is missing. */
  delete(key: string): Promise<void>;

  /** Whether a file exists for the given key. */
  exists(key: string): Promise<boolean>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
