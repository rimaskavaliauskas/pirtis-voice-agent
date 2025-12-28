import { isValidSessionId, ApiError } from '@/lib/api';

describe('API Client', () => {
  describe('isValidSessionId', () => {
    it('returns true for valid UUID', () => {
      expect(isValidSessionId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('returns true for uppercase UUID', () => {
      expect(isValidSessionId('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isValidSessionId('')).toBe(false);
    });

    it('returns false for random string', () => {
      expect(isValidSessionId('not-a-uuid')).toBe(false);
    });

    it('returns false for incomplete UUID', () => {
      expect(isValidSessionId('123e4567-e89b-12d3-a456')).toBe(false);
    });

    it('returns false for UUID without hyphens', () => {
      expect(isValidSessionId('123e4567e89b12d3a456426614174000')).toBe(false);
    });
  });

  describe('ApiError', () => {
    it('creates error with message and status', () => {
      const error = new ApiError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.status).toBe(404);
      expect(error.name).toBe('ApiError');
    });

    it('creates error with details', () => {
      const details = { field: 'email', reason: 'invalid' };
      const error = new ApiError('Validation failed', 400, details);

      expect(error.details).toEqual(details);
    });

    it('is instance of Error', () => {
      const error = new ApiError('Test', 500);

      expect(error).toBeInstanceOf(Error);
    });
  });
});
