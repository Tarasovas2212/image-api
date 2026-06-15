import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import request from 'supertest';
import configuration from '../src/config/configuration';
import { Image } from '../src/images/entities/image.entity';
import { ImagesModule } from '../src/images/images.module';
import { StorageModule } from '../src/storage/storage.module';

describe('Images API (e2e)', () => {
  let app: INestApplication;
  let storageDir: string;

  const makeImage = (w: number, h: number) =>
    sharp({
      create: { width: w, height: h, channels: 3, background: '#3366ff' },
    })
      .png()
      .toBuffer();

  beforeAll(async () => {
    storageDir = join(tmpdir(), `image-api-e2e-${Date.now()}`);
    process.env.STORAGE_DIR = storageDir;
    process.env.APP_BASE_URL = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Image],
          synchronize: true,
        }),
        StorageModule,
        ImagesModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('POST /images uploads, resizes and returns the image object', async () => {
    const file = await makeImage(400, 300);
    const res = await request(app.getHttpServer())
      .post('/images')
      .field('title', 'Sunset over the bay')
      .field('width', '100')
      .field('height', '100')
      .attach('file', file, 'sunset.png')
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Sunset over the bay',
      width: 100,
      height: 100,
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.url).toContain(`/images/${res.body.id}/file`);
  });

  it('POST /images rejects a non-image file', async () => {
    await request(app.getHttpServer())
      .post('/images')
      .field('title', 'Not an image')
      .attach('file', Buffer.from('hello world'), 'note.txt')
      .expect(422);
  });

  it('POST /images requires a title', async () => {
    const file = await makeImage(50, 50);
    await request(app.getHttpServer())
      .post('/images')
      .attach('file', file, 'x.png')
      .expect(400);
  });

  it('GET /images lists images with pagination meta', async () => {
    const res = await request(app.getHttpServer())
      .get('/images?page=1&limit=10')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /images filters by title (contains, case-insensitive)', async () => {
    const file = await makeImage(60, 60);
    await request(app.getHttpServer())
      .post('/images')
      .field('title', 'Mountain morning')
      .attach('file', file, 'm.png')
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/images?title=mountain')
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.every((i: any) =>
        i.title.toLowerCase().includes('mountain'),
      ),
    ).toBe(true);
  });

  it('GET /images/:id returns a single image, and /file serves bytes', async () => {
    const file = await makeImage(120, 80);
    const created = await request(app.getHttpServer())
      .post('/images')
      .field('title', 'Single')
      .attach('file', file, 's.png')
      .expect(201);

    const id = created.body.id;

    const single = await request(app.getHttpServer())
      .get(`/images/${id}`)
      .expect(200);
    expect(single.body.id).toBe(id);

    const fileRes = await request(app.getHttpServer())
      .get(`/images/${id}/file`)
      .expect(200);
    expect(fileRes.headers['content-type']).toContain('image/');
    expect(fileRes.body.length).toBeGreaterThan(0);
  });

  it('GET /images/:id returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .get('/images/11111111-1111-1111-1111-111111111111')
      .expect(404);
  });
});
