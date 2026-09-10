/**
 * Document fixtures, each verified against the check-digit algorithm during planning
 * (research.md R-002) rather than invented at test-writing time.
 */
export const VALID_CPFS = ['52998224725', '39053344705'] as const;
export const VALID_CNPJS = ['11222333000181'] as const;

/** Pass the checksum arithmetic; excluded only by the explicit repeated-digit rule (FR-006). */
export const REPEATED_DIGIT = ['11111111111', '00000000000', '11111111111111'] as const;

export const BAD_CHECK_DIGIT = ['52998224724', '12345678900', '11222333000182'] as const;
export const WRONG_LENGTH = ['1234567890', '123456789012345', '', '1'] as const;

export const FORMATTED_EQUIVALENTS: Array<[string, string]> = [
  ['529.982.247-25', '52998224725'],
  ['  529.982.247-25  ', '52998224725'],
  ['11.222.333/0001-81', '11222333000181'],
];
