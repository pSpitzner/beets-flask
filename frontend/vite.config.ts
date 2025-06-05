import { defineConfig } from "vite";
import reactProd from "@vitejs/plugin-react";
import reactDev from "@vitejs/plugin-react-swc";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";

const ReactCompilerConfig = {
    target: "19", // '17' | '18' | '19'
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const isProd = mode === "production";

    return {
        plugins: [
            tsconfigPaths(),
            TanStackRouterVite({ autoCodeSplitting: true }),
            // React compiler plugin for production builds
            isProd
                ? reactProd({
                      babel: {
                          plugins: [
                              ["babel-plugin-react-compiler", ReactCompilerConfig],
                          ],
                      },
                  })
                : reactDev(),
            svgr(),
        ],
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
                "^/socket.io/.*": {
                    target: "http://localhost:5001",
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
    };
});
