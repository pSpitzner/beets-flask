/** Common page components */

import { Box, styled } from "@mui/material";

/** Common wrapper for typical a typical page layout
 * adds a bit of css styling to allow for
 * dynamic break points on mobile.
 *
 * A column with some spacing on the left and right.
 *
 */
export const PageWrapper = styled(Box)(({ theme }) => ({
    //previously ContainerWidth class
    width: "100%",
    margin: "0 auto",
    maxWidth: "540px",
    paddingBlock: "0.5rem",
    paddingInline: "0.5rem",
    [theme.breakpoints.up("mobile")]: {
        maxWidth: "720px",
    },
    [theme.breakpoints.up("tablet")]: {
        maxWidth: "960px",
    },
    [theme.breakpoints.up("laptop")]: {
        maxWidth: "1140px",
    },
    [theme.breakpoints.up("desktop")]: {
        maxWidth: "1320px",
    },
}));
