import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import {
    createTheme,
    Experimental_CssVarsProvider as CssVarsProvider,
    experimental_extendTheme as extendTheme,
    ThemeProvider as MatThemeProvider,
} from "@mui/material/styles";

// Global styles
import "./main.css";

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
            MuiPaper: {
                styleOverrides: {
                    root: {
                        // Ensuring consistent dark mode color independent of paper elevation
                        backgroundImage: "none",
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
