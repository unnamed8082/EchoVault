import { getPlatform, getAPIBaseURL } from '../../src/lib/platform';

describe('platform', () => {
  describe('getPlatform', () => {
    it('should return a PlatformInfo object with required fields', () => {
      const info = getPlatform();
      expect(info).toHaveProperty('type');
      expect(info).toHaveProperty('isWeb');
      expect(info).toHaveProperty('isElectron');
      expect(info).toHaveProperty('isMobile');
    });

    it('should have type as one of valid values', () => {
      const info = getPlatform();
      expect(['web', 'electron', 'mobile']).toContain(info.type);
    });

    it('should have boolean flags that are consistent with type', () => {
      const info = getPlatform();
      if (info.type === 'web') {
        expect(info.isWeb).toBe(true);
        expect(info.isElectron).toBe(false);
        expect(info.isMobile).toBe(false);
      }
    });
  });

  describe('getAPIBaseURL', () => {
    it('should return a string', () => {
      const url = getAPIBaseURL();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });

    it('should return a URL starting with http', () => {
      const url = getAPIBaseURL();
      expect(url).toMatch(/^https?:\/\//);
    });
  });
});
