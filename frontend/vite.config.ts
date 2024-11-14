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
});
