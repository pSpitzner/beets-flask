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
            },
            secondary: {
                main: "#C07351",
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
