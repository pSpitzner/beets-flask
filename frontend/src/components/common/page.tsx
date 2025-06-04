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
    //On mobile devices, the page is full width
    width: "100%",
    maxWidth: "100%",
    [theme.breakpoints.up("laptop")]: {
        minWidth: theme.breakpoints.values.laptop,
        maxWidth: theme.breakpoints.values.desktop,
    },
    // centered
    margin: "0 auto",
}));
