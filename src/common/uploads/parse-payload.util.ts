import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children));
    }
  }
  return messages;
}

export async function parseMultipartPayload<T extends object>(
  dtoClass: new () => T,
  payload: string | undefined,
): Promise<T> {
  if (!payload?.trim()) {
    throw new BadRequestException('Missing multipart field "payload" (JSON)');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new BadRequestException('Invalid JSON in "payload" field');
  }

  const instance = plainToInstance(dtoClass, parsed, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const messages = flattenValidationErrors(errors);
    throw new BadRequestException(
      messages.length > 0 ? messages.join('; ') : 'Validation failed',
    );
  }

  return instance;
}
