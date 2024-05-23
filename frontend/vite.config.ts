import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import pluginPurgeCss from "vite-plugin-purgecss-updated-v5";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        TanStackRouterVite(),
        pluginPurgeCss({
            variables: true,
        }),
    ],
});
