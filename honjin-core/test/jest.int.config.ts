import type { Config } from 'jest';
import base from './jest.config';

const config: Config = {
    ...base,
    testMatch: ['<rootDir>/{src,test}/**/*.int.test.ts'],
    testPathIgnorePatterns: ['/node_modules/'],
    maxWorkers: 1,
    testTimeout: 30000
};

export default config;
