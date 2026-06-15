import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateImageDto {
  @ApiProperty({
    description: 'Human readable title for the image',
    example: 'Sunset over the bay',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description:
      'Target width in pixels. If both width and height are provided the ' +
      'image is cropped (cover) to that exact size; if only one is provided ' +
      'the other is derived from the aspect ratio.',
    minimum: 1,
    maximum: 10000,
    example: 800,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  width?: number;

  @ApiPropertyOptional({
    description: 'Target height in pixels. See `width` for cropping behaviour.',
    minimum: 1,
    maximum: 10000,
    example: 600,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  height?: number;
}
