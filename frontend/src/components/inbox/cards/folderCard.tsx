import { FolderIcon, InfoIcon, RefreshCwIcon, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
    Alert,
    AlertProps,
    AlertTitle,
    Box,
    Card,
    Divider,
    IconButton,
    styled,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { Link as MuiLink } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createLink, useParams, useRouter } from "@tanstack/react-router";

import { APIError } from "@/api/common";
import { sessionQueryOptions } from "@/api/session";
import { Folder } from "@/pythonTypes";

import { CardHeader } from "./common";

import { BackButton } from "../../common/inputs/back";
import { RetagButton } from "../actions";

/** Shows the general folder information!
 *
 * Might show optional things, depending on the session state.
 *
 * Handles the case where the folder hash
 * does not match the hash in the session.
 * -> integrity warning
 *
 * Allows to trigger a retagging of the folder.
 * -> no session found
 */
export function FolderCard({ folder }: { folder: Folder }) {
    const urlParams = useParams({ strict: false });

    const {
        data: session,
        isFetching,
        refetch,
        error,
    } = useQuery({
        ...sessionQueryOptions({
            folderPath: folder.full_path,
            folderHash: urlParams.hash ?? folder.hash,
        }),
        // Needed otherwise query is refetched on mount if errors occurred
        retryOnMount: false,
        refetchOnMount: false,
        retry: false,
    });

    // we need to sidestep useQuery a bit here to maintain the error state
    // while refetching, seems hacky but it works
    const [prevError, setPrevError] = useState<APIError | null>(null);
    useEffect(() => {
        if (error instanceof APIError) {
            setPrevError(error);
        }
        if (session) {
            setPrevError(null);
        }
    }, [error, session]);

    // Comparing hashes is a bit tricky, there are multiple cases:
    // 1. hash given by user in url -> this hash is used to fetch the session
    // 2. only path given by user in url -> folder is used to fetch the session
    // Thus we might have up to three hashes: url, session and folder
    const urlHash = urlParams.hash;
    const folderHash = folder.hash;
    const sessionHash = session?.folder_hash;
    const hashes = new Set<string>(
        [urlHash, folderHash, sessionHash].filter((x) => x != undefined)
    );
    const showHashWarning = hashes.size > 1;
    const showNoSessionWarning =
        prevError instanceof APIError && prevError.name == "NotFoundException";

    const counts = countFilesFolders(folder);

    return (
        <Card
            sx={{
                display: "flex",
                gap: 2,
                flexDirection: "column",
                padding: 2,
                bgcolor: "background.paper",
            }}
        >
            <CardHeader
                icon={<FolderIcon />}
                title={folder.full_path}
                subtitle={urlParams.hash ?? folder.hash}
            >
                <Box sx={{ ml: "auto", alignSelf: "flex-start" }}>
                    <Typography variant="caption" component="div" textAlign="right">
                        Includes {counts.nFiles} files <br /> in {counts.nFolders}{" "}
                        folders
                    </Typography>
                </Box>
            </CardHeader>
            {showHashWarning || showNoSessionWarning ? <Divider /> : null}
            {showHashWarning && (
                <HashWarning
                    folderPath={folder.full_path}
                    folderHash={folderHash}
                    urlHash={urlHash}
                    sessionHash={sessionHash}
                />
            )}
            {showNoSessionWarning && (
                <NoSessionFound
                    refetch={refetch}
                    refetchPending={isFetching}
                    folderPath={folder.full_path}
                    folderHash={urlParams.hash ?? folder.hash}
                />
            )}
            {!folder.is_album && <NoAlbumWarning />}
        </Card>
    );
}

function HashWarning({
    folderPath,
    urlHash,
    folderHash,
    sessionHash,
    ...props
}: {
    folderPath: string;
    folderHash: string;
    urlHash?: string;
    sessionHash?: string;
} & AlertProps) {
    return (
        <Alert
            severity="warning"
            icon={<TriangleAlert />}
            sx={{
                ".MuiAlert-message": { width: "100%" },
            }}
            {...props}
        >
            <AlertTitle>Integrity Warning</AlertTitle>
            <Box>
                The contents of this folder don't match what we expected. This could
                happen because:
                <Box component={"ul"} sx={{ marginTop: 1, marginBottom: 1 }}>
                    <li>
                        The files were modified since the last session, <b>or</b>
                    </li>
                    <li>The link you're using is no longer up to date.</li>
                </Box>
                <b>Proceed with caution!</b> Verify the changes or update the link to
                ensure you're working with the correct files.
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.25,
                    paddingBlock: 1,
                    paddingInline: 2,
                }}
            >
                {urlHash && (
                    <Box>
                        <Box>Hash found in url:</Box>
                        <Link
                            to="/inbox/folder/$path/$hash"
                            params={{
                                path: folderPath,
                                hash: urlHash,
                            }}
                            underline="none"
                            activeProps={{
                                sx: {
                                    color: "inherit",
                                    pointerEvents: "none",
                                },
                            }}
                            activeOptions={{ exact: true }}
                        >
                            <Code>{urlHash}</Code>
                        </Link>
                    </Box>
                )}
                {folderHash && (
                    <Box>
                        <Box>Hash from folder on disk:</Box>
                        <Link
                            to="/inbox/folder/$path/$hash"
                            params={{
                                path: folderPath,
                                hash: folderHash,
                            }}
                            activeProps={{
                                sx: {
                                    color: "inherit",
                                    pointerEvents: "none",
                                },
                            }}
                            underline="none"
                            activeOptions={{ exact: true }}
                        >
                            <Code>{folderHash}</Code>
                        </Link>
                    </Box>
                )}
                {sessionHash && (
                    <Box>
                        <Box>Hash from initial session run:</Box>
                        <Link
                            to="/inbox/folder/$path/$hash"
                            params={{
                                path: folderPath,
                                hash: sessionHash,
                            }}
                            activeProps={{
                                sx: {
                                    color: "inherit",
                                    pointerEvents: "none",
                                },
                            }}
                            underline="none"
                            activeOptions={{ exact: true }}
                        >
                            <Code>{sessionHash}</Code>
                        </Link>
                    </Box>
                )}
            </Box>
        </Alert>
    );
}

export const Code = styled("code")(({ theme }) => ({
    paddingInline: theme.spacing(0.5),
    paddingBlock: theme.spacing(0.1),
    fontFamily: "monospace",
    backgroundColor: theme.palette.background.default,
    width: "fit-content",
}));

function NoAlbumWarning() {
    return (
        <Alert
            severity="warning"
            icon={<TriangleAlert />}
            sx={{
                ".MuiAlert-message": { width: "100%" },
            }}
        >
            <AlertTitle>Folder not recognized as an album</AlertTitle>
            This folder doesn't seem to follow a typical album layout, which could lead
            to:
            <Box component={"ul"} sx={{ marginTop: 1, marginBottom: 1 }}>
                <li>
                    <b>Tagging issues</b>, such as incomplete metadata or skipped files
                </li>
                <li>
                    Disorganized files may lead to <b>incorrect import behavior</b>
                </li>
                <li>Complex multi task sessions</li>
            </Box>
            To ensure accurate processing, organize each album into its own folder.
        </Alert>
    );
}

function NoSessionFound({
    refetch,
    refetchPending,
    folderPath,
    folderHash,
    ...props
}: {
    folderPath: string;
    folderHash: string;
    refetch: () => void;
    refetchPending: boolean;
} & AlertProps) {
    const theme = useTheme();
    const router = useRouter();

    return (
        <>
            <Alert
                severity="info"
                icon={<InfoIcon />}
                sx={{
                    ".MuiAlert-message": {
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                    },
                }}
                {...props}
            >
                <AlertTitle>No active session found</AlertTitle>
                <Typography variant="body2">
                    Seems like you haven't started an import on this folder yet. If you
                    want to start a new import, choose one of the options below.
                </Typography>
            </Alert>
            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                    width: "100%",
                    paddingInline: 1,
                }}
            >
                <BackButton variant="outlined" color="secondary" />
                <Tooltip title="Retry to fetch the session.">
                    <IconButton
                        color="secondary"
                        size="medium"
                        sx={{
                            ml: "auto",
                            //animation on refetching
                            animation: refetchPending
                                ? "spin 1s linear infinite normal forwards"
                                : "none",
                            "@keyframes spin": {
                                "0%": {
                                    transform: "rotate(0deg)",
                                },
                                "100%": {
                                    transform: "rotate(360deg)",
                                },
                            },
                        }}
                        onClick={() => {
                            refetch();
                        }}
                    >
                        <RefreshCwIcon size={theme.iconSize.lg} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Retag this folder.">
                    <RetagButton
                        folderPaths={[folderPath]}
                        folderHashes={[folderHash]}
                        variant="contained"
                        color="secondary"
                        onRetag={async (r) => {
                            // Redirect to the correct tagging page i.e. the hash might change
                            // one a retag is triggered
                            const newHash = r[0].job_metas[0].folder_hash;
                            await router.navigate({
                                to: "/inbox/folder/$path/$hash",
                                params: {
                                    path: folderPath,
                                    hash: newHash,
                                },
                            });
                        }}
                    />
                </Tooltip>
            </Box>
        </>
    );
}

const Link = createLink(MuiLink);

function countFilesFolders(
    folder: Folder,
    s_acc: { nFolders: number; nFiles: number } | undefined = undefined
) {
    if (folder.children.length === 0) {
        return {
            nFolders: 1,
            nFiles: 0,
        };
    }
    return folder.children.reduce(
        (acc, child) => {
            if (child.type === "file") {
                acc["nFiles"] += 1;
            } else {
                acc["nFolders"] += 1;
                acc = countFilesFolders(child, acc);
            }
            return acc;
        },
        s_acc || { nFolders: 1, nFiles: 0 }
    );
}
