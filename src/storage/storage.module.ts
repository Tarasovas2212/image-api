import { Global, Module } from '@nestjs/common';
import { FilesystemStorageService } from './filesystem-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

/**
 * Storage is provided behind the STORAGE_SERVICE token. To switch drivers
 * (e.g. S3) implement StorageService and bind it here based on config.
 */
@Global()
@Module({
  providers: [
    FilesystemStorageService,
    {
      provide: STORAGE_SERVICE,
      useExisting: FilesystemStorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
