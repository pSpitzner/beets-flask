import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";

// Global styles
import "./main.css";

type DiffColors = {
    added: string;
    removed: string;
    changed: string;
    changedLight: string;
    light: string;
};

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
        hpc: true;
    }

    // Custom colors for to allow colorful beets diffs
    interface Palette {
        diffs: DiffColors;
    }
    interface PaletteOptions {
        diffs?: DiffColors;
    }
    interface PaletteColor {
        muted?: string;
    }
    interface SimplePaletteColorOptions {
        muted?: string;
    }

    // icon sizes
    interface Theme {
        iconSize: {
            xs: number;
            sm: number;
            md: number;
            lg: number;
            xl: number;
        };
    }
    interface ThemeOptions {
        iconSize?: {
            xs: number;
            sm: number;
            md: number;
            lg: number;
            xl: number;
        };
    }
}

/** Relative basic theme for now
 * using a mint green and a orange
 * as primary and secondary colors.
 * we need to to use experimental extendTheme and Provider to get
 * reusable (global) css variables
 */
const darkTheme = createTheme({
    iconSize: {
        xs: 12,
        sm: 16,
        md: 18,
        lg: 20,
        xl: 24,
    },

    palette: {
        mode: "dark",
        primary: {
            main: "#7FFFD4",
            muted: "#89a99e",
        },
        secondary: {
            // Complementary pink for secondary as compared to primary
            main: "#ff7faa",
            muted: "#cca3b0",
        },
        text: {
            primary: "#ffffff",
            // overwriting secondary fixes the transparency (bad on icons)
            secondary: "#ACB3B9",
        },
        action: {
            // hover: "#212529",
            hover: "#3A3C3E",
            selected: "#7C848E22",
        },
        background: {
            default: "#000000",
            paper: "#181A1C",
        },
        diffs: {
            // added: "#a4bf8c",
            added: "#A0D582",
            // removed: "#c0626b",
            removed: "#74454B",
            changed: "#ebcb8c",
            changedLight: "#403b31",
            light: "#6c757d",
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
            hpc: 1800,
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
