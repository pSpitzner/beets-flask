import { StyledEngineProvider } from "@mui/material/styles";
import {
    ThemeProvider as MatThemeProvider,
    createTheme,
    Experimental_CssVarsProvider as CssVarsProvider,
    experimental_extendTheme as extendTheme,
} from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Global styles
import "./index.css";

/** Relative basic theme for now
 * using a mint green and a orange
 * as primary and secondary colors.
 * we need to to use experimental extendTheme and Provider to get
 * reusable (global) css variables
 */
const darkTheme = extendTheme({
    ...createTheme({
        palette: {
            mode: "dark",
            primary: {
                main: "#7FFFD4",
                // muted: "#89a99e",
            },
            secondary: {
                main: "#C07351",
            },
            // TODO: hover color that works well with background of badges
            action: {
                hover: "#212529",
            },
        },
        components: {
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        backgroundColor: "#21252933",
                        borderRadius: "0.3rem",
                        backdropFilter: "blur(10px)",
                        padding: "0.5rem",
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: {
                        backgroundColor: "#21252933",
                        borderRadius: "0.3rem",
                        backdropFilter: "blur(10px)",
                        padding: "0.0rem",
                        backgroundImage: "none",
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        backgroundColor: "#0B0C0D",
                    },
                },
            },
            MuiAccordion: {
                styleOverrides: {
                    root: {
                        backgroundColor: "#0B0C0D",
                    },
                },
            },
        },
    }),
});

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <StyledEngineProvider injectFirst>
            <CssVarsProvider theme={darkTheme}>
                <MatThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    {children}
                </MatThemeProvider>
            </CssVarsProvider>
        </StyledEngineProvider>
    );
}
