import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [tsconfigPaths(), react(), TanStackRouterVite(), svgr()],
    // not minifying helped when debugging in production mode
    // we can enable this again when the code base is a bit more mature.
    build: {
        minify: false,
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: "modern-compiler",
            },
        },
    },
    server: {
        /** Allow the api calls to be
         * made to the another port during
         * development as the frontend and
         * backend are running independently
         * in dev.
         *
         * For production, the frontend and
         * backend are served from the quart
         * app, so the api calls are made
         * to and from the same port.
         */
        proxy: {
            "^/api_v1/.*": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
        },
    },
});
