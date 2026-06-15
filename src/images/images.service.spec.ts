import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import { Image } from './entities/image.entity';
import { ImageProcessorService } from './image-processor.service';
import { ImagesService } from './images.service';

describe('ImagesService', () => {
  let service: ImagesService;

  const repo = {
    create: jest.fn((x) => x),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const storage = {
    save: jest.fn(),
    read: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };
  const processor = { process: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: getRepositoryToken(Image), useValue: repo },
        { provide: STORAGE_SERVICE, useValue: storage },
        { provide: ImageProcessorService, useValue: processor },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://localhost:3000' },
        },
      ],
    }).compile();

    service = moduleRef.get(ImagesService);
  });

  describe('create', () => {
    it('processes, stores file and persists entity, returning a response dto', async () => {
      processor.process.mockResolvedValue({
        buffer: Buffer.from('img'),
        width: 50,
        height: 50,
        format: 'png',
        mimeType: 'image/png',
        size: 3,
      });
      storage.save.mockResolvedValue('key.png');
      repo.save.mockImplementation(async (e) => ({
        ...e,
        createdAt: new Date(),
      }));

      const result = await service.create(
        { buffer: Buffer.from('raw') } as any,
        { title: 'Hello', width: 50, height: 50 },
      );

      expect(processor.process).toHaveBeenCalledWith(expect.any(Buffer), {
        width: 50,
        height: 50,
      });
      expect(storage.save).toHaveBeenCalled();
      expect(result.title).toBe('Hello');
      expect(result.width).toBe(50);
      expect(result.url).toMatch(/\/images\/.+\/file$/);
    });

    it('rolls back the stored file when the DB write fails', async () => {
      processor.process.mockResolvedValue({
        buffer: Buffer.from('img'),
        width: 10,
        height: 10,
        format: 'jpeg',
        mimeType: 'image/jpeg',
        size: 3,
      });
      storage.save.mockResolvedValue('key.jpeg');
      repo.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.create({ buffer: Buffer.from('raw') } as any, {
          title: 'X',
        }),
      ).rejects.toThrow('db down');
      expect(storage.delete).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the image does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('builds a paginated response with correct meta', async () => {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([
            [{ id: 'a', title: 'A', width: 1, height: 1 }],
            5,
          ]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        title: 'a',
        page: 2,
        limit: 2,
      });

      expect(qb.where).toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(2);
      expect(result.meta).toEqual({
        total: 5,
        page: 2,
        limit: 2,
        totalPages: 3,
      });
      expect(result.data).toHaveLength(1);
    });
  });
});
