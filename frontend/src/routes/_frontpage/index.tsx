import {
    BookOpenIcon,
    BugIcon,
    ChevronRight,
    GithubIcon,
    HardDriveIcon,
    LibraryIcon,
    LucideIcon,
    TimerIcon,
} from "lucide-react";
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Divider,
    Link,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { Link as TanLink } from "@tanstack/react-router";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { inboxStatsQueryOptions } from "@/api/inbox";
import { libraryStatsQueryOptions } from "@/api/library";
import { PenaltyTypeIcon } from "@/components/common/icons";
import { PageWrapper } from "@/components/common/page";
import { humanizeBytes } from "@/components/common/units/bytes";
import { humanizeDuration, relativeTime } from "@/components/common/units/time";
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
    const theme = useTheme();
    const [libraryStats, inboxStats] = Route.useLoaderData();

    return (
        <PageWrapper
            sx={(theme) => ({
                paddingTop: 2,
                minHeight: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxWidth: `${theme.breakpoints.values.laptop}px !important`,
            })}
        >
            <Outlet />
            <Hero />
            <Box
                sx={{
                    display: "flex",
                    gap: 5,
                    flexDirection: "column",
                    paddingInline: 1,
                }}
            >
                <Card sx={{ padding: 2 }}>
                    <Box sx={{ position: "relative" }}>
                        <Divider
                            sx={{
                                position: "absolute",
                                top: "calc(50% + 1px)",
                                width: "100%",
                                backgroundColor: "primary.main",
                                borderBottomWidth: 2,
                            }}
                        />
                        <Box
                            sx={{
                                paddingLeft: 4,
                                paddingRight: 1,
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                zIndex: 1,
                            }}
                        >
                            <Avatar
                                variant="rounded"
                                sx={{
                                    width: 56,
                                    height: 56,
                                    backgroundColor: "primary.main",
                                    "& > img": {
                                        margin: 0,
                                        backgroundColor: "common.white",
                                    },
                                }}
                            >
                                <LibraryIcon size={36} />
                            </Avatar>
                            <Tooltip title="Last item added to library.">
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        color: "grey.600",
                                        whiteSpace: "nowrap",
                                        letterSpacing: "1px",
                                    }}
                                >
                                    last import:{" "}
                                    {relativeTime(libraryStats.lastItemAdded)}
                                </Typography>
                            </Tooltip>
                        </Box>
                    </Box>
                    <CardContent
                        sx={{
                            paddingInline: 1,
                            paddingTop: 2,
                            m: 0,
                            paddingBottom: "0 !important",
                        }}
                    >
                        <Typography
                            fontWeight={600}
                            fontSize={16}
                            color="grey.600"
                            fontFamily="monospace"
                        >
                            {libraryStats.libraryPath}
                        </Typography>
                        <Typography variant="h5" fontWeight={800} letterSpacing={0.5}>
                            Library
                        </Typography>
                        <Box
                            sx={{
                                display: "flex",
                                gap: 2,
                                paddingTop: 2.5,
                                flexWrap: "wrap",
                            }}
                        >
                            <StatItem
                                title="Total Runtime"
                                icon={<TimerIcon />}
                                value={humanizeDuration(libraryStats.runtime)}
                            />
                            <StatItem
                                title="Size"
                                icon={<HardDriveIcon />}
                                value={humanizeBytes(libraryStats.size)}
                            />
                            <StatItem
                                title="Items"
                                icon={<PenaltyTypeIcon type="tracks" />}
                                value={libraryStats.items}
                            />
                            <StatItem
                                title="Albums"
                                icon={<PenaltyTypeIcon type="album" />}
                                value={libraryStats.albums}
                            />
                            <StatItem
                                title="Artists"
                                icon={<PenaltyTypeIcon type="artist" />}
                                value={libraryStats.artists}
                            />
                            <StatItem
                                title="Labels"
                                icon={<PenaltyTypeIcon type="label" />}
                                value={libraryStats.labels}
                            />
                        </Box>
                        <Box
                            sx={(theme) => ({
                                paddingTop: 3,
                                display: "flex",
                                gap: 2,
                                fontWeight: 600,
                                justifyContent: "flex-end",
                                [theme.breakpoints.down("tablet")]: {
                                    ">*": {
                                        width: "100%",
                                    },
                                },
                            })}
                        >
                            <Button
                                variant="contained"
                                color="primary"
                                endIcon={<ChevronRight />}
                                component={TanLink}
                                to="/library/browse"
                                size="large"
                                sx={{
                                    fontWeight: 600,
                                }}
                            >
                                Browse Library
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
            <LibraryStatsComponent stats={libraryStats} />
            <Footer />
        </PageWrapper>
    );
}

/* ---------------------------------- Stats --------------------------------- */
// TODO: Cleanup new stats and move into inbox components (also above)

function StatItem({
    title,
    icon,
    value,
}: {
    title: React.ReactNode;
    icon: React.ReactNode;
    value: React.ReactNode;
}) {
    return (
        <Box
            sx={(theme) => ({
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 1,
                padding: 0.5,
                minWidth: "100px",
            })}
        >
            <Typography
                component="div"
                sx={{
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: "grey.800",
                }}
            >
                <Box
                    sx={(theme) => ({
                        width: theme.iconSize.sm,
                        height: theme.iconSize.sm,
                        display: "flex",
                        alignItems: "center",
                    })}
                >
                    {icon}
                </Box>
                {title}
            </Typography>
            <Typography
                variant="h6"
                fontWeight={600}
                fontFamily="monospace"
                color="grey.600"
                sx={{ paddingLeft: 1, textAlign: "right", width: "100%" }}
            >
                {value}
            </Typography>
        </Box>
    );
}

/* ------------------------------- Hero section ----------------------------- */

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
                </Box>
            </Box>
        </Box>
    );
}

/* ------------------------------ Footer section ---------------------------- */

function Footer() {
    const theme = useTheme();
    return (
        <Box
            sx={(theme) => ({
                paddingTop: 3,
                paddingBottom: 1,
                paddingInline: 1,
                display: "flex",
                gap: 2,
                marginTop: "auto",
                justifyContent: "flex-end",
                alignItems: "flex-end",
                // do not show spans with text on mobile
                [theme.breakpoints.down("tablet")]: {
                    ">*>span": {
                        display: "none",
                    },
                },
                a: {
                    display: "flex",
                    alignItems: "flex-end",
                },
            })}
        >
            <Typography
                variant="caption"
                sx={{ color: "grey.700", mr: "auto", alignSelf: "flex-end" }}
            >
                &copy; 2025 P. Spitzner &amp; S. Mohr
            </Typography>

            <Link
                href="https://beets-flask.readthedocs.io/en/latest/"
                target="_blank"
                variant="body2"
            >
                <BookOpenIcon size={theme.iconSize.lg} />
                <Typography variant="caption">&nbsp;Documentation</Typography>
            </Link>
            <Link
                href="https://github.com/pSpitzner/beets-flask"
                target="_blank"
                variant="body2"
            >
                <GithubIcon size={theme.iconSize.lg} />
                <Typography variant="caption">&nbsp;GitHub</Typography>
            </Link>
            <Link
                href="https://github.com/pSpitzner/beets-flask/issues/new"
                target="_blank"
                variant="body2"
            >
                <BugIcon size={theme.iconSize.lg} />
                <Typography variant="caption">&nbsp;Report a bug</Typography>
            </Link>
        </Box>
    );
}
