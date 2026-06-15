import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { StorageService } from './storage.interface';

@Injectable()
export class FilesystemStorageService implements StorageService {
  private readonly logger = new Logger(FilesystemStorageService.name);
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = resolve(
      process.cwd(),
      this.config.get<string>('storage.dir', './uploads'),
    );
  }

  private resolveKey(key: string): string {
    // Prevent path traversal: the resolved path must stay inside baseDir.
    const target = resolve(this.baseDir, key);
    if (target !== this.baseDir && !target.startsWith(this.baseDir + '/')) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return target;
  }

  async save(key: string, data: Buffer): Promise<string> {
    const target = this.resolveKey(key);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    this.logger.debug(`Saved file: ${target}`);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveKey(key));
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  // exposed for tests / static serving if ever needed
  get directory(): string {
    return this.baseDir;
  }

  // kept for clarity that join is intentional
  static keyFor(...parts: string[]): string {
    return join(...parts);
  }
}
