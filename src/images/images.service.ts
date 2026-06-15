import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  STORAGE_SERVICE,
  StorageService,
} from '../storage/storage.interface';
import { CreateImageDto } from './dto/create-image.dto';
import {
  ImageResponseDto,
  PaginatedImagesDto,
} from './dto/image-response.dto';
import { QueryImagesDto } from './dto/query-images.dto';
import { Image } from './entities/image.entity';
import { ImageProcessorService } from './image-processor.service';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
    private readonly processor: ImageProcessorService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('baseUrl', 'http://localhost:3000');
  }

  async create(
    file: Express.Multer.File,
    dto: CreateImageDto,
  ): Promise<ImageResponseDto> {
    const processed = await this.processor.process(file.buffer, {
      width: dto.width,
      height: dto.height,
    });

    const id = uuidv4();
    const storageKey = `${id}.${processed.format}`;
    await this.storage.save(storageKey, processed.buffer);

    try {
      const image = this.imageRepository.create({
        id,
        title: dto.title,
        storageKey,
        mimeType: processed.mimeType,
        format: processed.format,
        width: processed.width,
        height: processed.height,
        size: processed.size,
      });
      const saved = await this.imageRepository.save(image);
      return ImageResponseDto.fromEntity(saved, this.baseUrl);
    } catch (err) {
      // Roll back the stored file if the DB write fails to avoid orphans.
      await this.storage.delete(storageKey);
      throw err;
    }
  }

  async findAll(query: QueryImagesDto): Promise<PaginatedImagesDto> {
    const { title, page, limit } = query;

    const qb = this.imageRepository
      .createQueryBuilder('image')
      .orderBy('image.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (title) {
      // Portable case-insensitive "contains" filter (works on Postgres & sqlite).
      qb.where('LOWER(image.title) LIKE LOWER(:title)', {
        title: `%${title}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((i) => ImageResponseDto.fromEntity(i, this.baseUrl)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<ImageResponseDto> {
    const image = await this.getEntityOrThrow(id);
    return ImageResponseDto.fromEntity(image, this.baseUrl);
  }

  /** Returns the raw bytes + content type for serving the file. */
  async getFile(
    id: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const image = await this.getEntityOrThrow(id);
    const exists = await this.storage.exists(image.storageKey);
    if (!exists) {
      throw new NotFoundException(`File for image ${id} is missing`);
    }
    const buffer = await this.storage.read(image.storageKey);
    return { buffer, mimeType: image.mimeType };
  }

  private async getEntityOrThrow(id: string): Promise<Image> {
    const image = await this.imageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`Image with id ${id} not found`);
    }
    return image;
  }
}
