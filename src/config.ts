enum CACHE_TYPES {
  LOCAL = 'local',
  REMOTE = 'remote',
  LOCAL_FIRST = 'local-first',
  REMOTE_FIRST = 'remote-first'
}

type ZenithConfig = {
  ZENITH_READ_ONLY: boolean,
  ZENITH_DEBUG: boolean,
  CACHE_TYPE: CACHE_TYPES,
  S3_ACCESS_KEY: string,
  S3_SECRET_KEY: string,
  S3_BUCKET_NAME: string
  S3_ENDPOINT: string | undefined,
  S3_REGION: string,
  ZENITH_DEBUG_ID: string,
  LOCAL_CACHE_PATH: string
};

type ConfigKeyMap = {
  [K in keyof ZenithConfig]: ZenithConfig[K]
};


class ConfigManager {
  private config: ConfigKeyMap;

  constructor() {
    const cacheType = process.env.CACHE_TYPE as CACHE_TYPES || CACHE_TYPES.LOCAL;
    if (!Object.values(CACHE_TYPES).includes(cacheType)) {
      // eslint-disable-next-line no-console
      console.warn(`Invalid CACHE_TYPE value '${cacheType}', defaulting to '${CACHE_TYPES.LOCAL}'`);
    }
    this.config = {
      ZENITH_READ_ONLY: Boolean(process.env.ZENITH_READ_ONLY) || false,
      ZENITH_DEBUG: Boolean(process.env.ZENITH_DEBUG) || false,
      CACHE_TYPE: Object.values(CACHE_TYPES).includes(cacheType) ? cacheType : CACHE_TYPES.LOCAL,
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'my-access-key',
      S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'my-secret-key',
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'my-bucket',
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_REGION: process.env.S3_REGION || 'us-east-1',
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