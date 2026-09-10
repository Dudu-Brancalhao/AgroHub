import { Prisma } from '@prisma/client';
import { registerDecorator, ValidationOptions } from 'class-validator';

export interface AreaConstraints {
  /** Smallest accepted value. 0 for the parts, 0.01 for the total (FR-015). */
  min: number;
  /** Label used in the pt-BR message, e.g. "A área total". */
  label: string;
}

/**
 * Validates an area AFTER @ToDecimal has converted it.
 *
 * class-transformer applies transforms before class-validator runs, so by the time validation
 * happens the value is a Prisma.Decimal — and @IsNumber would reject it for not being a `number`.
 * This validator works on the decimal directly, which is what lets the DTO stop holding plain
 * numbers at the boundary (research.md R-001).
 *
 * A value the transform could not convert arrives here unchanged, and is rejected as invalid
 * rather than reaching the database.
 */
export function IsArea(constraints: AreaConstraints, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isArea',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!(value instanceof Prisma.Decimal)) {
            return false;
          }
          if (!value.isFinite()) {
            return false;
          }
          if (value.decimalPlaces() > 2) {
            return false;
          }
          return value.greaterThanOrEqualTo(new Prisma.Decimal(constraints.min));
        },
        defaultMessage(): string {
          return constraints.min > 0
            ? `${constraints.label} deve ser um número maior que zero, com no máximo 2 casas decimais.`
            : `${constraints.label} deve ser um número maior ou igual a zero, com no máximo 2 casas decimais.`;
        },
      },
    });
  };
}
