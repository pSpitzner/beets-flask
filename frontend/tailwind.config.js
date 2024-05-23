import { radixThemePreset } from 'radix-themes-tw';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [
    ],
    // your existing configuration
    presets: [radixThemePreset]
}

