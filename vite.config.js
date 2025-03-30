import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import path from 'path';

export default defineConfig({
    plugins: [vue()],
    server: {
        port: 3000,
    },
    build: {
        outDir: path.resolve(__dirname, 'dist'),
    },
});