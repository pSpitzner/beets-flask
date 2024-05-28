import { StyledEngineProvider } from "@mui/material/styles";
import { ThemeProvider as MatThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Global styles
import "./index.css";

/** Relative basic theme for now
 * using a mint green and a orange
 * as primary and secondary colors.
 */
const darkTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: "#7FFFD4",
        },
        secondary: {
            main: "#C07351",
        },
    },
});

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <StyledEngineProvider injectFirst>
            <MatThemeProvider theme={darkTheme}>
                <CssBaseline />
                {children}
            </MatThemeProvider>
        </StyledEngineProvider>
    );
}
