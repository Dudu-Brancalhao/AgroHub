import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { isValidDocument } from './document';

/** Validates a CPF or CNPJ by its check digits, not by its length (FR-005, FR-006). */
export function IsDocument(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDocument',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidDocument(value),
        defaultMessage: (_args: ValidationArguments) => 'Informe um CPF ou CNPJ válido.',
      },
    });
  };
}
