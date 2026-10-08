import type { Config } from 'jest';

const config: Config = {
    rootDir: '..',
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '\\.int\\.test\\.ts$'],
    transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { ignoreCodes: [151001] } }] }
};

export default config;
