import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateImageDto } from './dto/create-image.dto';
import {
  ImageResponseDto,
  PaginatedImagesDto,
} from './dto/image-response.dto';
import { QueryImagesDto } from './dto/query-images.dto';
import { ImagesService } from './images.service';

const MAX_FILE_SIZE = Number.parseInt(
  process.env.MAX_FILE_SIZE_BYTES ?? `${15 * 1024 * 1024}`,
  10,
);

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload, process and store an image',
    description:
      'Accepts a multipart/form-data request with the image file plus a ' +
      'title and optional width/height. The image is resized/cropped and ' +
      'optimized before being stored.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpeg, png, webp, gif, tiff, avif, ...)',
        },
        title: { type: 'string', maxLength: 255, example: 'Sunset over the bay' },
        width: { type: 'integer', minimum: 1, maximum: 10000, example: 800 },
        height: { type: 'integer', minimum: 1, maximum: 10000, example: 600 },
      },
    },
  })
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or file missing' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif|tiff|avif|bmp|svg\+xml)$/ })
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @Body() dto: CreateImageDto,
  ): Promise<ImageResponseDto> {
    return this.imagesService.create(file, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List images',
    description:
      'Returns a paginated list of images. Supports a case-insensitive ' +
      '"title contains" filter.',
  })
  @ApiOkResponse({ type: PaginatedImagesDto })
  async findAll(@Query() query: QueryImagesDto): Promise<PaginatedImagesDto> {
    return this.imagesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single image by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ImageResponseDto })
  @ApiNotFoundResponse({ description: 'Image not found' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ImageResponseDto> {
    return this.imagesService.findOne(id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Download the binary image file' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({
    description: 'The raw image bytes',
    content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({ description: 'Image or file not found' })
  async getFile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType } = await this.imagesService.getFile(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buffer);
  }
}
