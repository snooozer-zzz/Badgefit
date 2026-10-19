import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' keeps asset URLs relative, which is what Capacitor (iOS/Android) needs later.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
