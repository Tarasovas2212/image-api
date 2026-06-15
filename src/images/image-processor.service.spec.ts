import { UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service';

async function makePng(width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  beforeEach(() => {
    service = new ImageProcessorService();
  });

  it('crops to the exact dimensions when both width and height are given', async () => {
    const input = await makePng(200, 100);
    const result = await service.process(input, { width: 50, height: 50 });

    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.format).toBe('png');
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBeGreaterThan(0);
  });

  it('scales proportionally when only width is given', async () => {
    const input = await makePng(200, 100);
    const result = await service.process(input, { width: 100 });

    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });

  it('keeps original dimensions when no size is requested', async () => {
    const input = await makePng(120, 80);
    const result = await service.process(input, {});

    expect(result.width).toBe(120);
    expect(result.height).toBe(80);
  });

  it('throws UnprocessableEntity for non-image input', async () => {
    await expect(
      service.process(Buffer.from('not an image'), {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
