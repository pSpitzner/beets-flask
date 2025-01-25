# Template

Basic React + TypeScript + TanStack Router scaffold for Vite.

TODO:
- [ ] Add correct dist folder to host by flask
- [ ] Port templates from quart to react

## Install

```bash
npm install

# To test without backend
npm run dev

# To test with backend
npm run build:dev

# To build for production
npm run build
```


## Features

For routing, we use [TanStack Router](https://tanstack.com/) which is a simple and fast router for React. We are using file based routing for this project.



We are using Radix UI for the design system. You can find the documentation [here](https://www.radix-ui.com/). Further we are using tailwindcss for styling. You can find the documentation [here](https://tailwindcss.com/). Recommended to use the tailwind vscode extension for better intellisense.


## Build

By default, the build is set to the `dist` folder. This is to allow flask to serve the files. We can change this in the vite config file tho if needed.

We purge unused css in production build. This is done by the `vite-plugin-purgecss-updated-v5` plugin. This might cause some issues with the css not sure yet. We can disable this in the vite config file if needed.