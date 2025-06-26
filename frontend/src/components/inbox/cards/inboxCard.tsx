import { PlusIcon, Settings } from "lucide-react";
import { useMemo } from "react";
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";

import { useConfig } from "@/api/config";
import { InboxTypeIcon } from "@/components/common/icons";
import { CardHeader } from "@/components/frontpage/statsCard";
import {
    FolderActionDesktopBar,
    ImportSplitButton,
    RetagSplitButton,
} from "@/components/inbox/actions";
import {
    FolderComponent,
    GridWrapper,
    SelectedStats,
} from "@/components/inbox/fileTree";
import { Folder } from "@/pythonTypes";

import { DeleteImportedFoldersButton } from "../actions2/deleteFolders";

export function InboxCard({ folder }: { folder: Folder }) {
    const config = useConfig();

    // configuration for this inbox folder
    const folderConfig = useMemo<(typeof config)["gui"]["inbox"]["folders"][0]>(() => {
        const fc = Object.entries(config.gui.inbox.folders).find(
            ([_k, v]) => v.path === folder.full_path
        );

        return fc
            ? fc[1]
            : {
                  name: "Inbox",
                  autotag: false,
                  path: folder.full_path,
              };
    }, [config, folder.full_path]);

    const innerFolders = useMemo(() => {
        // Filter out folders that are not albums or files
        return folder.children.filter((f) => f.type === "directory");
    }, [folder.children]);

    const threshold = folderConfig.auto_threshold ?? config.match.strong_rec_thresh;

    let tooltip: string;
    switch (folderConfig.autotag) {
        case "auto":
            tooltip =
                "Automatic tagging and import enabled. " +
                (1 - threshold) * 100 +
                "% threshold.";
            break;
        case "preview":
            tooltip = "Automatic tagging enabled, but no import.";
            break;
        case "bootleg":
            tooltip = "Import as-is, and split albums by meta-data.";
            break;
        default:
            tooltip = "No automatic tagging or import enabled.";
            break;
    }

    return (
        <Card
            sx={(theme) => ({
                width: "100%",
                padding: 2,

                // Content (file tree)
                ".MuiCardContent-root": {
                    margin: 0,
                    paddingTop: 2,
                    paddingInline: 1,
                },

                // Actions (buttons)
                ".MuiCardActions-root": {
                    display: "flex",
                    flexDirection: "row",
                },

                // Remove some padding on very small screens
                [theme.breakpoints.down("tablet")]: {
                    padding: 1,
                    paddingInline: 0,
                    ".MuiCardContent-root": {
                        paddingInline: 0.5,
                    },
                    ".MuiCardActions-root": {},
                },
            })}
        >
            <CardHeader
                key={folder.full_path}
                icon={
                    <Tooltip title={tooltip}>
                        <InboxTypeIcon
                            size={24}
                            type={folderConfig.autotag || undefined}
                        />
                    </Tooltip>
                }
                dividerPos="70%"
                color="secondary.main"
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        width: "100%",
                        justifyContent: "space-between",
                        position: "relative",
                        paddingBottom: 2.5,
                        paddingLeft: 1,
                    }}
                >
                    {/* file path */}
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            flexDirection: "row",
                            alignItems: "flex-end",
                            width: "100%",

                            columnGap: 0.5,
                            rowGap: 0.1,
                        }}
                    >
                        {folderConfig.path
                            .split("/")
                            .filter(Boolean)
                            .map((segment, idx, arr) => (
                                <Typography
                                    variant="body2"
                                    key={idx}
                                    component="span"
                                    sx={{
                                        display: "inline-flex",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {`/ ${segment}${idx === arr.length - 1 && folderConfig.path.endsWith("/") ? " /" : ""}`}
                                </Typography>
                            ))}
                    </Box>

                    {/* inbox name */}
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: "bold",
                            flexShrink: 0,
                            m: 0,
                            p: 0,
                        }}
                    >
                        {folderConfig.name}
                    </Typography>
                </Box>
            </CardHeader>
            <CardContent>
                <GridWrapper>
                    {/* Only show inner folders */}
                    <SelectedStats />
                    {innerFolders.map((innerFolder) => (
                        <FolderComponent
                            key={innerFolder.full_path}
                            folder={innerFolder}
                        />
                    ))}
                    {innerFolders.length === 0 && (
                        <Box
                            sx={{
                                gridColumn: "1 / -1",
                                textAlign: "center",
                                color: "secondary.muted",
                            }}
                        >
                            No folders in this inbox.
                        </Box>
                    )}
                </GridWrapper>
            </CardContent>
            <CardActions>
                {/* <DeleteImportedFoldersButton folder={folder} /> */}

                <RetagSplitButton
                    sx={(theme) => ({
                        [theme.breakpoints.down("tablet")]: {
                            ".MuiButton-root": {
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                margin: 0,
                                paddingTop: 1.2,
                                gap: 0.25,

                                span: {
                                    margin: 0,
                                },
                                fontSize: theme.typography.caption.fontSize,
                            },
                        },
                    })}
                />
                <ImportSplitButton
                    sx={(theme) => ({
                        [theme.breakpoints.down("tablet")]: {
                            ".MuiButton-root": {
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                margin: 0,
                                paddingTop: 1.2,
                                gap: 0.25,

                                span: {
                                    margin: 0,
                                },
                                fontSize: theme.typography.caption.fontSize,
                            },
                        },
                        ml: "auto !important", // Align to the right
                    })}
                />
            </CardActions>
        </Card>
    );
}
