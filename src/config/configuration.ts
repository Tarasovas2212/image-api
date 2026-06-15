export interface AppConfig {
  port: number;
  baseUrl: string;
  maxFileSizeBytes: number;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    synchronize: boolean;
  };
  storage: {
    driver: string;
    dir: string;
  };
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default (): AppConfig => ({
  port: toInt(process.env.PORT, 3000),
  baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  maxFileSizeBytes: toInt(process.env.MAX_FILE_SIZE_BYTES, 15 * 1024 * 1024),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'images',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'filesystem',
    dir: process.env.STORAGE_DIR ?? './uploads',
  },
});
