import { ArrowLeftIcon, FolderIcon, ImportIcon, TagIcon } from "lucide-react";
import {
    Avatar,
    Box,
    Button,
    Step,
    StepLabel,
    Stepper,
    styled,
    Typography,
    useTheme,
} from "@mui/material";
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
                    Stepper needs more work or maybe we just remove it
                    <SessionStepper step="preview" />
                    {/* Session info */}
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
                                {data.folder_path}
                            </Typography>
                            <Typography variant="body2" component="div">
                                {data.folder_hash}
                            </Typography>
                        </Box>
                        <Box sx={{ ml: "auto", alignSelf: "flex-start" }}>
                            <Typography variant="caption" component="div">
                                Includes{" "}
                                {data.tasks.reduce(
                                    (acc, task) => acc + task.items.length,
                                    0
                                )}{" "}
                                items
                            </Typography>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            width: "100%",
                            gap: 2,
                            justifyContent: "space-between",
                            backgroundColor: "background.paper",
                            borderRadius: 1,
                            padding: 2,
                            flexDirection: "column",
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
                                    Choose one of the following candidates to import.
                                    The selected candidate will be used to update the
                                    metadata of the files.
                                </Typography>
                            </Box>
                        </Box>
                        <TaskCandidates
                            task={data.tasks[0]}
                            folderHash={data.folder_hash}
                        ></TaskCandidates>
                    </Box>
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

import StepConnector, { stepConnectorClasses } from "@mui/material/StepConnector";

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.alternativeLabel}`]: {
        top: 19,
    },
    [`&.${stepConnectorClasses.active}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            backgroundImage: `linear-gradient( 95deg,${theme.palette.secondary.muted} 0%, ${theme.palette.secondary.main} 100%)`,
        },
    },
    [`&.${stepConnectorClasses.completed}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            backgroundImage: `linear-gradient( 95deg, ${theme.palette.secondary.muted} 0%,  ${theme.palette.secondary.muted} 100%)`,
        },
    },
    [`& .${stepConnectorClasses.line}`]: {
        height: 3,
        border: 0,
        backgroundColor: "#eaeaf0",
        borderRadius: 1,
        ...theme.applyStyles("dark", {
            backgroundColor: theme.palette.grey[800],
        }),
    },
}));

const ColorlibStepIconRoot = styled(Box)<{
    ownerState: { completed?: boolean; active?: boolean };
}>(({ theme }) => ({
    backgroundColor: "#ccc",
    zIndex: 1,
    color: theme.palette.common.white,
    width: 40,
    height: 40,
    display: "flex",
    borderRadius: "50%",
    justifyContent: "center",
    alignItems: "center",

    ...theme.applyStyles("dark", {
        backgroundColor: theme.palette.grey[700],
    }),
    variants: [
        {
            props: ({ ownerState }) => ownerState.active,
            style: {
                backgroundImage: `linear-gradient( 136deg,${theme.palette.secondary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                boxShadow: "0 4px 10px 0 rgba(0,0,0,.25)",
            },
        },
        {
            props: ({ ownerState }) => ownerState.completed,
            style: {
                backgroundImage: `linear-gradient( 95deg, ${theme.palette.secondary.muted} 0%,  ${theme.palette.secondary.muted} 100%)`,
            },
        },
    ],
}));

import { StepIconProps } from "@mui/material/StepIcon";

import { TaskCandidates } from "@/components/import/candidates/candidate";

function ColorlibStepIcon(props: StepIconProps) {
    const { active, completed, className } = props;

    return (
        <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
            {props.icon}
        </ColorlibStepIconRoot>
    );
}

function SessionStepper({ step }: { step: "preview" | "import" }) {
    const options = [
        {
            label: "Created",
            icon: <FolderIcon />,
        },
        {
            label: "Tagged",
            icon: <TagIcon />,
        },
        {
            label: "Imported",
            icon: <ImportIcon />,
        },
    ];

    return (
        <Stepper
            alternativeLabel
            activeStep={step === "preview" ? 1 : 2}
            connector={<ColorlibConnector />}
            sx={{
                width: "100%",

                ".MuiStep-alternativeLabel:nth-of-type(1)": {
                    flexGrow: 0.5,
                    paddingLeft: 0,
                    "& > * ": {
                        "& > *": {
                            display: "flex",
                            width: "auto",
                        },
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        flexShrink: 1,
                    },
                },

                ".MuiStep-alternativeLabel:nth-of-type(3)": {
                    flexGrow: 0.5,
                    paddingRight: 0,
                    "& > * ": {
                        "& > *": {
                            display: "flex",
                            width: "auto",
                        },
                        justifyContent: "flex-end",
                        alignItems: "flex-end",
                        flexShrink: 1,
                    },
                    ".MuiStepConnector-root": {
                        width: "calc(200% - 20px)",
                        left: "-100%",
                    },
                },

                ".MuiStepLabel-label": {
                    marginTop: 0.75,
                    "&.Mui-completed": {
                        color: "secondary.muted",
                    },
                    "&.Mui-active": {
                        color: "secondary.main",
                    },
                },
            }}
        >
            {options.map(({ label, icon }) => (
                <Step key={label}>
                    <StepLabel
                        slots={{
                            stepIcon: ColorlibStepIcon,
                        }}
                        icon={icon}
                    >
                        {label}
                    </StepLabel>
                </Step>
            ))}
        </Stepper>
    );
}
