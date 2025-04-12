import { Box, Divider, Typography } from "@mui/material";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { inboxStatsQueryOptions } from "@/api/inbox";
import { libraryStatsQueryOptions } from "@/api/library";
import { PageWrapper } from "@/components/common/page";
import { InboxStatsComponent } from "@/components/inbox/stats";
import { LibraryStatsComponent } from "@/components/library/stats";

/* ------------------------------ Route layout ------------------------------ */

export const Route = createFileRoute("/_frontpage/")({
    component: Index,
    loader: async ({ context }) => {
        return await Promise.all([
            context.queryClient.ensureQueryData(libraryStatsQueryOptions()),
            context.queryClient.ensureQueryData(inboxStatsQueryOptions()),
        ]);
    },
    staleTime: 20_000, // 20 seconds
});

/** The frontpage is layout which adds an overview
 * of the current inbox, displaying the number of files,
 * the size, the number of tagged files, the size of tagged.
 * Also some redis stats are shown.
 *
 * It also gives an outlet to render other relevant content
 * underneath. This may also be used to render a modal.
 */
function Index() {
    const [libraryStats, inboxStats] = Route.useLoaderData();

    return (
        <PageWrapper sx={{ paddingBlock: 2 }}>
            <Outlet />
            <Hero />
            <LibraryStatsComponent stats={libraryStats} />
            <InboxStatsComponent inboxStats={inboxStats} />
        </PageWrapper>
    );
}

function Hero() {
    // Readme: Breakpoints are set to align with the font
    // and size of the logo. Using the set breakpoints for
    // different devices will not work as expected here
    return (
        <Box sx={{ margin: "0 auto" }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "min-content auto",
                    columnGap: 2,
                    justifyContent: "center",

                    "@media (max-width: 500px)": {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    },
                }}
            >
                <Box
                    component="img"
                    src="/logo.png"
                    alt="Logo"
                    sx={{
                        width: "150px",
                        height: "150px",
                        gridRow: "span 2",
                        gridColumn: "1",
                        "@media (max-width: 890px)": {
                            gridRow: "1",
                            gridColumn: "1",
                        },
                    }}
                />
                <Typography
                    component="h1"
                    variant="h2"
                    sx={{
                        fontSize: 64,
                        alignSelf: "flex-end",
                        "@media (max-width: 500px)": {
                            alignSelf: "center",
                        },
                    }}
                    fontWeight={600}
                >
                    Beets-flask
                </Typography>
                <Box
                    sx={{
                        gridRow: "2",
                        gridColumn: "2",
                        "@media (max-width: 890px)": {
                            gridRow: "2",
                            gridColumn: "span 2",
                            paddingTop: 1,
                            paddingLeft: 2,
                            paddingRight: 1,
                        },
                        width: "100%",
                    }}
                >
                    <Typography
                        component="h2"
                        variant="h6"
                        sx={{
                            color: "grey.500",
                            "@media (max-width: 890px)": {
                                textAlign: "center",
                                width: "100%",
                            },
                        }}
                    >
                        Web interface around your favorite music tagger and music
                        library.
                    </Typography>
                    {/* Copyright */}
                    <Typography
                        variant="caption"
                        sx={{
                            color: "grey.800",
                            "@media (max-width: 890px)": {
                                textAlign: "center",
                                width: "100%",
                            },
                        }}
                        component="div"
                    >
                        &copy; 2025 Beets-flask contributors
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}
