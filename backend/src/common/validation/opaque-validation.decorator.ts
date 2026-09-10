export const OPAQUE_VALIDATION_KEY = 'opaqueValidation';

/**
 * Marks a DTO whose validation failures must NOT be itemised back to the caller.
 *
 * On an ordinary endpoint, telling a client exactly which fields are malformed is good design and
 * is what FR-013 asks for. On a credential endpoint it is a needless second channel: the caller
 * already knows what they sent, so field-level detail buys them nothing legitimate while giving an
 * attacker a way to distinguish "your JSON was wrong" from "your credentials were wrong".
 *
 * A DTO carrying this marker collapses to the same generic 401 a failed credential check
 * produces. The field-level detail is not discarded - it is logged server-side against the same
 * requestId, so a frontend developer can still diagnose a malformed payload from the logs.
 */
export function OpaqueValidationErrors(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(OPAQUE_VALIDATION_KEY, true, target);
  };
}

export function hasOpaqueValidation(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) {
    return false;
  }
  return Reflect.getMetadata(OPAQUE_VALIDATION_KEY, target.constructor) === true;
}
