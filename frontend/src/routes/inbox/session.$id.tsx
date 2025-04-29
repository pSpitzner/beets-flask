import { ArrowLeftIcon, FolderIcon, ImportIcon, TagIcon } from "lucide-react";
import {
    Avatar,
    Box,
    Button,
    Card,
    CardHeader,
    styled,
    Typography,
    useTheme,
} from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

import { sessionQueryOptions } from "@/api/session";
import { Loading } from "@/components/common/loading";
import { PageWrapper } from "@/components/common/page";
import { Progress, SerializedException, SerializedSessionState } from "@/pythonTypes";

export const Route = createFileRoute("/inbox/session/$id")({
    component: RouteComponent,
    loader: async ({ context, params }) => {
        await context.queryClient.prefetchQuery(
            sessionQueryOptions({ folderHash: params.id })
        );
    },
    // custom pending and error components
    // for this subpage
    pendingComponent: () => (
        <PageWrapper
            sx={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                justifyContent: "center",
                flexDirection: "column",
            }}
        >
            <LoadingWithStatus feedback="Looking for your session" />
        </PageWrapper>
    ),
    // This error component only used for data fetching errors
    // typically this should be 404
    errorComponent: ({ error }) => {
        const theme = useTheme();
        const router = useRouter();

        return (
            <PageWrapper
                sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    justifyContent: "center",
                    flexDirection: "column",
                }}
            >
                <NeonSignText
                    variant="body1"
                    color="error"
                    sx={{
                        mt: 2,
                        padding: 2,
                    }}
                >
                    Session could not be found!
                </NeonSignText>
                <Typography variant="body2" color="text.secondary">
                    {error.message}
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                    }}
                >
                    <Button
                        sx={{
                            mt: 8,
                            mr: 1,
                        }}
                        variant="outlined"
                        color="secondary"
                        size="small"
                        startIcon={<ArrowLeftIcon size={theme.iconSize.md} />}
                        onClick={async () => {
                            if (router.history.canGoBack()) {
                                router.history.back();
                            } else {
                                await router.navigate({
                                    to: "/",
                                });
                            }
                        }}
                    >
                        Go Back
                    </Button>
                    <Button
                        sx={{ mt: 8 }}
                        size="small"
                        onClick={async () => {
                            await router.invalidate();
                        }}
                        color="secondary"
                        variant="contained"
                    >
                        Retry
                    </Button>
                </Box>
            </PageWrapper>
        );
    },
});

function LoadingWithStatus({
    status,
    feedback,
}: {
    status?: Progress;
    feedback?: string;
}) {
    const theme = useTheme();
    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    maxWidth: "120px",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <Loading noteColor={theme.palette.secondary.muted} />
            </Box>
            <Box>
                <NeonSignText sx={{ marginTop: 3 }}>
                    {status ? Progress[status] : feedback}
                </NeonSignText>
            </Box>
        </>
    );
}

const NeonSignText = styled(Typography)(({ theme }) => ({
    textShadow: `0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 
        0 0 20px ${theme.palette.secondary.main},
        0 0 30px ${theme.palette.secondary.main},
        0 0 40px ${theme.palette.secondary.main},
        0 0 50px ${theme.palette.secondary.main},
        0 0 75px ${theme.palette.secondary.main}`,
    letterSpacing: "5px",
    // Add a bit of flicker
    animation: "flicker 2s infinite",
    "@keyframes flicker": {
        "0%, 18%, 22%, 25%, 53%, 57%, 100%": {
            opacity: 1,
        },
        "20%, 24%, 55%": {
            opacity: 0.5,
        },
    },
    color: theme.palette.secondary.muted,
}));

/** The main component for the session route.
 *
 * Shows the allowed actions for the session.
 */
function RouteComponent() {
    const { data } = useSuspenseQuery(
        sessionQueryOptions({ folderHash: Route.useParams().id })
    );

    /** Depending on the status of the session
     * we want to show different things.
     */

    // Exception handling
    if (data.exc !== null && data.exc !== undefined) {
        return (
            <PageWrapper
                sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                }}
            >
                <SessionException session={data} exc={data.exc} />
            </PageWrapper>
        );
    }

    // Show loading indicator is session is not completed
    // FIXME: This is more of theoretical thing. We do not have
    // a websocket connection yet to communicate the progress
    // of a session thus the loading indicator is not really
    // used yet.
    // Should be used in the future tho.
    switch (data.status.progress) {
        case Progress.PREVIEW_COMPLETED:
        case Progress.DELETION_COMPLETED:
        case Progress.IMPORT_COMPLETED:
            break;
        default:
            return (
                <PageWrapper
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        justifyContent: "center",
                        flexDirection: "column",
                    }}
                >
                    <LoadingWithStatus status={data.status.progress} />
                </PageWrapper>
            );
    }

    return (
        <PageWrapper
            sx={(theme) => ({
                [theme.breakpoints.up("laptop")]: {
                    padding: 2,
                    gap: 2,
                },
                padding: 0.5,
                gap: 1,
                display: "flex",
                flexDirection: "column",
            })}
        >
            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                    flexDirection: "column",
                    padding: 2,
                }}
            >
                Stepper needs more work or maybe we just remove it
                <SessionStepper
                    step={
                        data.status.progress < Progress.IMPORT_COMPLETED
                            ? "preview"
                            : "import"
                    }
                />
            </Box>

            {/* Session info */}
            <SessionOverviewCard session={data} />
            {/* Session preview card */}
            <SessionPreviewCard session={data} />
            <SessionImportCard session={data} />
        </PageWrapper>
    );
}

/** Shown if an session exception occurs
 *
 * Allows to gracefully recover from an exception. At the moment
 * all exceptions are handled equally but in theory we could e.g.
 * handle the duplicate 'ask' exception differently.
 */
import { JSONPretty } from "@/components/common/json";
import { humanizeDuration, relativeTime } from "@/components/common/units/time";
import { SessionStepper } from "@/components/experimental/stepper";
import {
    SelectedCandidate,
    TaskCandidates,
} from "@/components/import/candidates/candidate";
import { GenericErrorCard } from "@/errors";

function SessionException({
    session,
    exc,
}: {
    session: SerializedSessionState;
    exc: SerializedException;
}) {
    // TODO: Match different errors here
    // e.g. if the error is a duplicate ask
    // we could show a different component and allow
    // the user to choose what to do instead

    return (
        <GenericErrorCard
            title="Session Error"
            subtitle="Seems like you found an unexpected error!"
            color="secondary"
            exc={exc}
            showSocials={true}
        />
    );
}

/** Shows the general session information
 * should be independent of the session state
 * e.g. folder path, number of items, etc.
 */
function SessionOverviewCard({ session }: { session: SerializedSessionState }) {
    return (
        <Box
            sx={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                padding: 2,
                bgcolor: "background.paper",
                borderRadius: 1,
            }}
        >
            <Avatar
                sx={{
                    color: "white",
                    bgcolor: "secondary.main",
                }}
            >
                <FolderIcon />
            </Avatar>
            <Box>
                <Typography
                    variant="body2"
                    component="div"
                    sx={{
                        fontWeight: 600,
                    }}
                >
                    {session.folder_path}
                </Typography>
                <Typography variant="body2" component="div">
                    {session.folder_hash}
                </Typography>
            </Box>
            <Box sx={{ ml: "auto", alignSelf: "flex-start" }}>
                <Typography variant="caption" component="div" textAlign="right">
                    Includes{" "}
                    {session.tasks.reduce((acc, task) => acc + task.items.length, 0)}{" "}
                    items
                </Typography>
            </Box>
        </Box>
    );
}

/** Shows the  */

function SessionPreviewCard({ session }: { session: SerializedSessionState }) {
    // Show selected candidate if progress is
    // imported
    // Chosen candidate
    const candidate = session.tasks[0].candidates.find(
        (cand) => cand.id === session.tasks[0].chosen_candidate_id
    );

    if (session.status.progress < Progress.IMPORT_COMPLETED) {
        return (
            <Card sx={{ padding: 2 }}>
                <Box
                    sx={{
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                    }}
                >
                    <Avatar
                        sx={{
                            color: "white",
                            bgcolor: "secondary.main",
                        }}
                    >
                        <TagIcon />
                    </Avatar>
                    <Box>
                        <Typography
                            variant="body2"
                            component="div"
                            sx={{
                                fontWeight: 600,
                            }}
                        >
                            Select a candidate
                        </Typography>
                        <Typography variant="body2" component="div">
                            Choose one of the following candidates to import. The
                            selected candidate will be used to update the metadata of
                            the files.
                        </Typography>
                    </Box>
                </Box>
                <TaskCandidates
                    task={session.tasks[0]}
                    folderHash={session.folder_hash}
                    folderPath={session.folder_path}
                />
            </Card>
        );
    } else if (session.status.progress === Progress.IMPORT_COMPLETED) {
        return (
            <Card sx={{ padding: 2 }}>
                <Box
                    sx={{
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                        mb: 1,
                    }}
                >
                    <Avatar
                        sx={{
                            color: "white",
                            bgcolor: "secondary.main",
                        }}
                    >
                        <TagIcon />
                    </Avatar>
                    <Box>
                        <Typography
                            variant="body2"
                            component="div"
                            sx={{
                                fontWeight: 600,
                            }}
                        >
                            Selected Candidate
                        </Typography>
                        <Typography variant="body2" component="div">
                            {candidate!.info.artist} - {candidate!.info.album}
                        </Typography>
                    </Box>
                    <Box sx={{ ml: "auto", alignSelf: "flex-start" }}>
                        <Typography variant="caption" component="div" textAlign="right">
                            Metadata fetched {relativeTime(candidate?.created_at)}
                        </Typography>
                    </Box>
                </Box>
                <SelectedCandidate
                    task={session.tasks[0]}
                    folderHash={session.folder_hash}
                    folderPath={session.folder_path}
                />
            </Card>
        );
    }

    return null;
}

function SessionImportCard({ session }: { session: SerializedSessionState }) {
    if (session.status.progress < Progress.IMPORT_COMPLETED) {
        return null;
    }

    return (
        <Card
            sx={{
                padding: 2,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                }}
            >
                <Avatar
                    sx={{
                        color: "white",
                        bgcolor: "secondary.main",
                        zIndex: 1,
                    }}
                >
                    <ImportIcon />
                </Avatar>
                <Box>
                    <Typography
                        variant="body2"
                        component="div"
                        sx={{
                            fontWeight: 600,
                        }}
                    >
                        Imported into beets library
                    </Typography>
                    <Typography variant="body2" component="div">
                        TODO: How to get the beets id here?
                    </Typography>
                </Box>
                <Box sx={{ ml: "auto", alignSelf: "flex-start" }}>
                    <Typography variant="caption" component="div" textAlign="right">
                        Imported {relativeTime(session?.updated_at)}
                    </Typography>
                </Box>
            </Box>
        </Card>
    );
}
