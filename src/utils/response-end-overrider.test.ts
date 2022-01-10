import { Response } from 'express';

import { responseEndOverrider } from './response-end-overrider';

describe('Response End Overrider Test', () => {
  let mockResponse: Partial<Response>;

  test('can override response end', () => {
    mockResponse = {
      end: jest.fn(),
    };

    const fn = jest.fn();
    const expectResponse = 'lorem dolor';
    const expectBufferResponse = Buffer.from(expectResponse);

    responseEndOverrider(mockResponse as Response, fn);

    if (mockResponse.end) {
      mockResponse.end(expectBufferResponse);
    }

    expect(fn).toBeCalledTimes(1);
    expect(fn).toBeCalledWith(expectResponse);
  });

  test('can override response end with data from write', () => {
    mockResponse = {
      write: jest.fn(),
      end: jest.fn(),
    };

    const fn = jest.fn();
    const phrase1 = 'Lorem ipsum dolor sit amet';
    const phrase2 = 'consectetur adipiscing elit';
    const expectResponse = phrase1 + phrase2;

    responseEndOverrider(mockResponse as Response, fn);

    if (mockResponse.write) {
      mockResponse.write(phrase1);
      mockResponse.write(phrase2);
    }

    if (mockResponse.end) {
      mockResponse.end();
    }

    expect(fn).toBeCalledTimes(1);
    expect(fn).toBeCalledWith(expectResponse);
  });
});
