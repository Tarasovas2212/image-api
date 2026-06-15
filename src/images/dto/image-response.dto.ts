import { ApiProperty } from '@nestjs/swagger';
import { Image } from '../entities/image.entity';

export class ImageResponseDto {
  @ApiProperty({ format: 'uuid', example: 'b3b1e6e2-1f2a-4c8e-9f3d-2a1b6c7d8e9f' })
  id: string;

  @ApiProperty({ example: 'Sunset over the bay' })
  title: string;

  @ApiProperty({
    description: 'Absolute URL to download the image file',
    example: 'http://localhost:3000/images/b3b1e6e2-1f2a-4c8e-9f3d-2a1b6c7d8e9f/file',
  })
  url: string;

  @ApiProperty({ example: 800 })
  width: number;

  @ApiProperty({ example: 600 })
  height: number;

  static fromEntity(image: Image, baseUrl: string): ImageResponseDto {
    const dto = new ImageResponseDto();
    dto.id = image.id;
    dto.title = image.title;
    dto.url = `${baseUrl.replace(/\/$/, '')}/images/${image.id}/file`;
    dto.width = image.width;
    dto.height = image.height;
    return dto;
  }
}

export class PaginationMetaDto {
  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class PaginatedImagesDto {
  @ApiProperty({ type: [ImageResponseDto] })
  data: ImageResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
