import { ArrowLeftIcon } from "lucide-react";
import { Box, Button, styled, Typography, useTheme } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";

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

    // Session is running or finished but no exception
    switch (data.status.progress) {
        case Progress.PREVIEW_COMPLETED:
        case Progress.DELETION_COMPLETED:
            return (
                <PageWrapper>
                    <h1>Generated previews</h1>
                    <pre>TODO</pre>
                </PageWrapper>
            );
        case Progress.IMPORT_COMPLETED:
            return (
                <PageWrapper>
                    <h1>Folder imported</h1>
                    <pre>TODO</pre>
                </PageWrapper>
            );
        default:
            // In theory we can show a loading indicator for each
            // of the sessions state here. We do not have
            // a websocket connection yet to communicate the progress
            // of a session but we could add this in the future
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
}

/** Shown if an session exception occurs
 *
 * Allows to gracefully recover from an exception. At the moment
 * all exceptions are handled equally but in theory we could e.g.
 * handle the duplicate 'ask' exception differently.
 */
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
