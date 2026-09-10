import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, registerDecorator, ValidationOptions } from 'class-validator';

export const MIN_HARVEST_YEAR = 1900;

/**
 * The upper bound is the current year plus one, computed at call time.
 *
 * A hardcoded constant becomes wrong at midnight on 31 December and stays wrong until someone
 * notices — which is why FR-022 is phrased relative to "the current year" and why this is a
 * function rather than a `const`.
 */
export function maxHarvestYear(): number {
  return new Date().getFullYear() + 1;
}

function IsPlausibleHarvestYear(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPlausibleHarvestYear',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= MIN_HARVEST_YEAR &&
          value <= maxHarvestYear(),
        defaultMessage: () =>
          `O ano da safra deve estar entre ${MIN_HARVEST_YEAR} e ${maxHarvestYear()}.`,
      },
    });
  };
}

export class CreateHarvestDto {
  @ApiProperty({ minimum: MIN_HARVEST_YEAR, example: 2021 })
  @Type(() => Number)
  @IsInt({ message: 'O ano da safra deve ser um número inteiro.' })
  @IsPlausibleHarvestYear()
  year!: number;
}
