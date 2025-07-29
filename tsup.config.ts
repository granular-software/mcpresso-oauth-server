import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['express', 'cors', 'compression', 'helmet'],
  platform: 'node',
  target: 'node18',
}) 