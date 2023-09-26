type ZenithConfig = {
  ZENITH_READ_ONLY: boolean,
  ZENITH_DEBUG: boolean,
  USE_REMOTE_CACHE: boolean,
  S3_ACCESS_KEY: string,
  S3_SECRET_KEY: string,
  S3_BUCKET_NAME: string
  S3_ENDPOINT: string|undefined,
  ZENITH_DEBUG_ID: string,
  LOCAL_CACHE_PATH: string
};

type ConfigKeyMap = {
  [K in keyof ZenithConfig]: ZenithConfig[K]
};


class ConfigManager {
  private config: ConfigKeyMap;

  constructor() {
    this.config = {
      ZENITH_READ_ONLY: Boolean(process.env.ZENITH_READ_ONLY) || false,
      ZENITH_DEBUG: Boolean(process.env.ZENITH_DEBUG) || false,
      USE_REMOTE_CACHE: Boolean(process.env.USE_REMOTE_CACHE) || false,
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'my-access-key',
      S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'my-secret-key',
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'my-bucket',
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      ZENITH_DEBUG_ID: process.env.ZENITH_DEBUG_ID || 'debug-log',
      LOCAL_CACHE_PATH: process.env.LOCAL_CACHE_PATH || '.cache'
    };
  }

  getConfigValue<K extends keyof ZenithConfig>(keyName: K): ZenithConfig[K] {
      return this.config[keyName];
  }

  updateConfig(updatedConfig: Partial<ZenithConfig>): void {
      this.config = { ...this.config, ...updatedConfig };
  }

  getCachePath(): string {
    if (typeof this.config.LOCAL_CACHE_PATH === 'string') return this.config.LOCAL_CACHE_PATH;
    return '.cache';
  }
}

export const configManagerInstance = new ConfigManager();