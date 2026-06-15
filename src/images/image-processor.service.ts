import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  mimeType: string;
  size: number;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
}

const FORMAT_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  gif: 'image/gif',
};

/**
 * Wraps sharp. Resizes/crops to the requested dimensions and re-encodes the
 * image with sensible optimization settings while preserving the original
 * format where possible.
 */
@Injectable()
export class ImageProcessorService {
  async process(input: Buffer, options: ResizeOptions): Promise<ProcessedImage> {
    let pipeline: sharp.Sharp;
    let metadata: sharp.Metadata;

    try {
      pipeline = sharp(input, { failOn: 'error' });
      metadata = await pipeline.metadata();
    } catch {
      throw new UnprocessableEntityException(
        'Uploaded file is not a valid or supported image',
      );
    }

    if (!metadata.format) {
      throw new UnprocessableEntityException('Could not detect image format');
    }

    // Drop EXIF orientation by baking it into pixels, strip metadata on output.
    pipeline = pipeline.rotate();

    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        // cover => scale then crop to fill the exact box when both dims given;
        // with a single dimension it scales proportionally.
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: false,
      });
    }

    const outputFormat = this.normalizeFormat(metadata.format);
    pipeline = this.applyFormat(pipeline, outputFormat);

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      format: outputFormat,
      mimeType: FORMAT_MIME[outputFormat] ?? 'application/octet-stream',
      size: info.size,
    };
  }

  private normalizeFormat(format: string): string {
    // Animated/less-ideal-for-photos inputs are normalized to broadly supported
    // formats. GIF is kept as PNG to avoid animation handling complexity.
    if (format === 'gif') return 'png';
    if (FORMAT_MIME[format]) return format;
    return 'jpeg';
  }

  private applyFormat(pipeline: sharp.Sharp, format: string): sharp.Sharp {
    switch (format) {
      case 'png':
        return pipeline.png({ compressionLevel: 9, palette: true });
      case 'webp':
        return pipeline.webp({ quality: 82 });
      case 'avif':
        return pipeline.avif({ quality: 50 });
      case 'tiff':
        return pipeline.tiff({ quality: 80 });
      case 'jpeg':
      default:
        return pipeline.jpeg({ quality: 82, mozjpeg: true });
    }
  }
}
