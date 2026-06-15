/**
 * Generates the OpenAPI v3 spec to ./openapi.json WITHOUT a database or
 * storage connection. Swagger only needs route/decorator metadata, so we boot
 * a throwaway module that wires the controller against stub providers.
 *
 * Run with: `npm run openapi`
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ImagesController } from './images/images.controller';
import { ImagesService } from './images/images.service';

@Module({
  controllers: [ImagesController],
  providers: [{ provide: ImagesService, useValue: {} }],
})
class DocsModule {}

async function generate() {
  const app = await NestFactory.create(DocsModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Image API')
    .setDescription('REST API for uploading, processing and serving images')
    .setVersion('1.0')
    .addTag('images')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

generate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
