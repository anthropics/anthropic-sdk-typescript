import * as Errors from '@anthropic-ai/sdk/core/error';
import { ERROR_CODE_CLASSES } from '@anthropic-ai/sdk/core/error-classes';

describe('name', () => {
  const errorClasses = [...Object.values(Errors), ...ERROR_CODE_CLASSES.values()];

  // A class that fails here needs a `static override readonly _errorName` of its own.
  test.each(errorClasses.map((ErrorClass) => [ErrorClass.name, ErrorClass] as const))(
    '%s declares its own',
    (className, ErrorClass) => {
      expect(ErrorClass._errorName).toBe(className);
    },
  );

  test('is the class name of the error for a response status', () => {
    const error = Errors.APIError.generate(400, undefined, undefined, new Headers());

    expect(error.name).toBe('BadRequestError');
  });

  test('is not enumerable', () => {
    const error = new Errors.APIConnectionError({ message: 'boom' });

    expect(Object.keys(error)).not.toContain('name');
  });

  test('takes the value that a hand-written subclass assigns', () => {
    class CustomError extends Errors.APIConnectionError {
      constructor() {
        super({ message: 'boom' });
        this.name = 'CustomError';
      }
    }

    const error = new CustomError();

    expect(error.name).toBe('CustomError');
  });
});
