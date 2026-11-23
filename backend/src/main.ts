import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '3mb' }));

  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-ID'],
  });

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Response Envelope Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NIRVAGAM SaaS Platform API')
    .setDescription(
      'Enterprise Business Billing, Accounting, Inventory & Management REST API engine'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Nirvagam API Documentation',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Nirvagam Backend Service active on http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger Documentation accessible at http://localhost:${port}/api/docs`);
}

bootstrap();
