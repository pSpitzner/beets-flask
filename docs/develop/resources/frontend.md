# Frontend

The frontend is a website that is statically generated on build with the help of [Vite](https://vitejs.dev/). You can find all realted files in the `frontend` folder.


We use the follow `Tech Stack`:

-   [React](https://react.dev/)
-   [Vite](https://vitejs.dev/)
-   [Tanstack router](https://tanstack.com/router/latest)
-   [MUI Core](https://mui.com/material-ui/all-components/)
-   [Lucide icons](https://lucide.dev/icons/)


## Package manager

We use [pnpm](https://pnpm.io/) as package manager. If you have npm or yarn installed, you can install pnpm via corepack:
```bash
corepack enable pnpm
corepack use pnpm@latest 
```
alternatively follow the isntallation guide [here](https://pnpm.io/installation).

## Scripts

We expose some helper scripts in the package.json which you can run outside of the container. You can run them with `pnpm <script>`:

-  `check-types`: Tries to transpile the code and check for types. 
- `lint`: Runs the eslint and prettier checks on the code.
- `analyze`: Runs the vite build and analyzes the bundle size (will open a new tab in your browser).

The `dev` and `build` script are used for development and production builds. You should not run them manually, start the dev or prod docker container instead. 