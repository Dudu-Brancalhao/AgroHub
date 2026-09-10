import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildValidationPipeOptions } from './common/validation/validation-pipe.options';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildSwaggerConfig } from './common/swagger/document.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(buildValidationPipeOptions()));
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService);

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  // persistAuthorization keeps the token across a page reload, so a refresh does not
  // silently drop it and produce a 401 that looks like a server problem.
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.get<number>('port') ?? 3000);
}

void bootstrap();
