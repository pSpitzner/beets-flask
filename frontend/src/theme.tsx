import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";

// Global styles
import "./main.css";

// TS Augmentation to add custom breakpoints (see below)
declare module "@mui/material/styles" {
    interface BreakpointOverrides {
        xs: false; // removes the `xs` breakpoint
        sm: false;
        md: false;
        lg: false;
        xl: false;
        mobile: true; // adds the `mobile` breakpoint
        tablet: true;
        laptop: true;
        desktop: true;
    }
}

/** Relative basic theme for now
 * using a mint green and a orange
 * as primary and secondary colors.
 * we need to to use experimental extendTheme and Provider to get
 * reusable (global) css variables
 */
const darkTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: "#7FFFD4",
            // muted: "#89a99e",
        },
        // tried to add custom colors, but did not work. c.f:
        // https://stackoverflow.com/questions/50069724/how-to-add-custom-material-ui-palette-colors
        secondary: {
            main: "#ffffff",
        },
        action: {
            hover: "#212529",
        },
        background: {
            default: "#000000",
            paper: "#181A1C",
        },
    },
    components: {
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: "#21252933",
                    borderRadius: "0.3rem",
                    backdropFilter: "blur(10px)",
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: {
                    backgroundColor: "#21252933",
                    borderRadius: "0.3rem",
                    backdropFilter: "blur(10px)",
                    backgroundImage: "none",
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    // Ensuring consistent dark mode color independent of paper elevation
                    backgroundImage: "none",
                },
            },
        },
    },

    breakpoints: {
        values: {
            mobile: 0,
            tablet: 640,
            laptop: 1024,
            desktop: 1200,
        },
    },

    colorSchemes: {
        dark: true,
    },
});

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <StyledEngineProvider injectFirst>
            <MuiThemeProvider theme={darkTheme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </StyledEngineProvider>
    );
}
