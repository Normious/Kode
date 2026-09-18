import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4009'),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/kode.db',
  logLevel: process.env.LOG_LEVEL || 'info',

  defaults: {
    size: parseInt(process.env.DEFAULT_SIZE || '400'),
    margin: parseInt(process.env.DEFAULT_MARGIN || '2'),
    errorCorrection: process.env.DEFAULT_ERROR_CORRECTION || 'M',
    foreground: process.env.DEFAULT_FOREGROUND || '#000000',
    background: process.env.DEFAULT_BACKGROUND || '#FFFFFF',
  },

  limits: {
    maxDataLength: parseInt(process.env.MAX_DATA_LENGTH || '4296'),
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '50'),
    maxImageSizeBytes: parseInt(process.env.MAX_IMAGE_SIZE_BYTES || '10485760'),
    maxImageDimension: parseInt(process.env.MAX_IMAGE_DIMENSION || '4096'),
  },

  scan: {
    tryHarder: process.env.SCAN_TRY_HARDER !== 'false',
  },
};
