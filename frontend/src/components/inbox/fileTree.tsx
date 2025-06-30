import {
    ChevronDown,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    InfoIcon,
    LucideChevronRight,
    Settings,
    SettingsIcon,
    SquareChartGanttIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import {
    Alert,
    AlertTitle,
    Box,
    BoxProps,
    Button,
    ButtonGroup,
    Checkbox,
    DialogContent,
    IconButton,
    iconClasses,
    List,
    ListItem,
    ListItemText,
    Paper,
    styled,
    Typography,
    useTheme,
} from "@mui/material";
import { Link } from "@tanstack/react-router";

import {
    InboxFolderGridConfig,
    useInboxFolderConfig,
    useInboxFolderGridConfig,
} from "@/api/config";
import {
    BestCandidateChip,
    DuplicateChip,
    FolderStatusChip,
    HashMismatchChip,
    StyledChip,
} from "@/components/common/chips";
import { FileTypeIcon, FolderTypeIcon } from "@/components/common/icons";
import { File, Folder } from "@/pythonTypes";

import { useFolderSelectionContext } from "./folderSelectionContext";
import { GridTemplateSettings } from "./settings/gridTemplateSettings";

import { JSONPretty } from "../common/debugging/json";
import { Dialog } from "../common/dialogs";

/* ------------------------------ Grid wrapper ------------------------------ */

type GridWrapperProps = {
    config: InboxFolderGridConfig;
};

export const GridWrapper = styled(Box)<GridWrapperProps>(({ theme, config }) => ({
    display: "grid",
    // Construct order of columns from config
    // Default should be "[selector] auto [tree] 1fr [chip] auto [actions] auto",
    gridTemplateColumns: config.gridTemplateColumns
        .map((col) => `[${col.name}] ${col.size}`)
        .join(" "),
    width: "100%",
    columnGap: theme.spacing(1.5),
    // Fill columns even if content is given in other order
    gridAutoFlow: "column dense",
    // Add zebra striping
    "> div:nth-of-type(odd)": {
        background: `linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.01) 0%,
            rgba(0, 0, 0, 0.2) 50%,
            rgba(0, 0, 0, 0.01) 100%
        )`,
    },

    ...Object.fromEntries(
        config.gridTemplateColumns.map((col) => [
            `.${col.name}`,
            {
                display: col.hidden ? "hidden" : undefined,
                gridColumn: col.name,
            },
        ])
    ),
}));

const GridRow = styled(Box)(({ theme }) => ({
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
    gridAutoFlow: "column dense",
    alignItems: "center",
    paddingInline: theme.spacing(0.5),
}));

/* ---------------------------- Folder & File component ---------------------------- */

const ICON_SIZE = 20;
// TODO: calculate dynamic depending on currently shown depth
const MAX_LEVEL = 5;

export function FolderComponent({
    folder,
    unSelectable = false,
    level = 0,
}: {
    folder: Folder;
    unSelectable?: boolean;
    level?: number;
}) {
    const [isOpen, setIsOpen] = useState(() => {
        // Open if folder does contain other folders
        // else closed (i.e. only file)
        if (folder.children.some((child) => child.type === "directory")) {
            return true;
        }
        return false;
    });
    const { isSelected, toggleSelect } = useFolderSelectionContext();

    // Create children elements from tree (recursive)
    const childElements = Object.entries(folder.children).map(([_key, values]) => {
        if (values.type === "file") {
            return (
                <FileComponent file={values} key={values.full_path} level={level + 1} />
            );
        } else if (values.type === "directory") {
            return (
                <FolderComponent folder={values} key={values.hash} level={level + 1} />
            );
        }
    });

    return (
        <>
            {/* Order inside the gridrow does not matter, set outside. */}
            <GridRow
                sx={(theme) => ({
                    borderRadius: 1,
                    position: "relative",
                    "&:hover, &[data-contextmenu='true']": {
                        background: `linear-gradient(
                            to right,
                            ${theme.palette.secondary.muted} 0%,
                            transparent 100%
                        ) !important`,
                    },
                    "&[data-selected='true']": {
                        backgroundColor: theme.palette.action.selected + " !important",
                    },
                })}
                data-selected={isSelected(folder)}
                onClick={() => toggleSelect(folder)}
            >
                {/* Current status of the folder */}
                <Chips folder={folder} />

                {/* Folder name and collapsable */}
                <FolderTreeRow
                    folder={folder}
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    level={level}
                />

                {/* Selector */}
                <Checkbox
                    className="selector"
                    size="medium"
                    checked={isSelected(folder)}
                    style={{ padding: 0 }}
                    color="secondary"
                    disabled={unSelectable}
                />

                {/* Link to subpage */}
                <Link
                    to="/inbox/folder/$path/$hash"
                    params={{ path: folder.full_path, hash: folder.hash }}
                    className="actions"
                    style={{
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                    }}
                >
                    <IconButton>
                        <SquareChartGanttIcon size={16} />
                    </IconButton>
                </Link>
            </GridRow>

            {/* Children */}
            {isOpen && childElements}
        </>
    );
}

export function FileComponent({ file, level = 0 }: { file: File; level?: number }) {
    return (
        <GridRow>
            <FileName file={file} level={level} />
        </GridRow>
    );
}

export function FolderTreeRow({
    folder,
    isOpen,
    setIsOpen,
    level = 0,
    ...props
}: {
    folder: Folder;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    level?: number;
} & BoxProps) {
    const whiteness = Math.max(100 - (MAX_LEVEL - level) * 15, 30);
    return (
        <LevelIndentWrapper
            level={level}
            className="tree"
            sx={(theme) => ({
                [theme.breakpoints.down("laptop")]: {
                    color: `hsl(210deg, 8.75%, ${whiteness}%)`,
                },
            })}
            {...props}
        >
            {/* Collapse/Expand button */}
            <IconButton
                onClick={(e) => {
                    setIsOpen(!isOpen);
                    e.stopPropagation();
                    e.preventDefault();
                }}
                size="small"
                sx={{
                    padding: "0px",
                    margin: "0px",
                    marginRight: "-2px",
                    color: "inherit",
                }}
                disableRipple
            >
                <LucideChevronRight
                    size={ICON_SIZE}
                    style={{
                        transform: isOpen ? "rotate(90deg)" : "",
                        transition: "transform 0.15s ease-in-out",
                    }}
                />
            </IconButton>

            <FolderTypeIcon
                isAlbum={folder.is_album}
                isOpen={isOpen}
                size={ICON_SIZE}
            />

            <Typography variant="body1" sx={{ paddingBlock: 0.25 }}>
                {folder.full_path.split("/").pop()}
            </Typography>
        </LevelIndentWrapper>
    );
}

function FileName({ file, level = 0 }: { file: File; level?: number }) {
    // Infer type from file ending
    const type = file.full_path.split(".").pop();
    const theme = useTheme();

    return (
        <LevelIndentWrapper
            level={level}
            className="tree"
            sx={{
                fontSize: "0.7rem",
                fontFamily: "monospace",
                color: "#999",
                gridColumnStart: "tree",
                gridColumnEnd: "-1 !important", // Allow full size
                minWidth: "0",
            }}
        >
            <Box
                sx={{
                    // for horizontal lines on desktop
                    position: "absolute",
                    left: ICON_SIZE / 2 - 0.5 + ICON_SIZE * (level - 1) + "px",
                    width: ICON_SIZE + "px",
                    height: "1px",
                    backgroundColor: "#495057",
                    flexShrink: 0,
                    [theme.breakpoints.down("laptop")]: {
                        visibility: "hidden",
                    },
                }}
            />
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: theme.spacing(1),
                    overflow: "hidden",
                    [theme.breakpoints.down("laptop")]: {
                        color: `hsl(210deg, 8.75%, 30%)`,
                    },
                }}
            >
                <FileTypeIcon
                    type={type}
                    size={ICON_SIZE * 0.7}
                    style={{
                        marginLeft: ICON_SIZE * 0.7 + "px",
                        flexShrink: 0,
                    }}
                />
                <Box
                    sx={{
                        overflow: "hidden",
                    }}
                >
                    <Typography
                        variant="body1"
                        sx={{
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            position: "relative",
                            maxWidth: "100%",
                            overflow: "hidden",
                        }}
                    >
                        {file.full_path.split("/").pop()}
                    </Typography>
                </Box>
            </Box>
        </LevelIndentWrapper>
    );
}

function LevelIndentWrapper({
    children,
    sx,
    level = 0,
    ...props
}: {
    children: React.ReactNode;
    level?: number;
} & BoxProps) {
    const theme = useTheme();

    return (
        <Box
            sx={[
                {
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingBlock: "1px",
                    position: "relative",
                    flexShrink: 0,
                    gap: "0.4rem",
                    paddingLeft: level * ICON_SIZE + "px",

                    // Mobile styling
                    [theme.breakpoints.down("laptop")]: {
                        paddingLeft: `calc(${level} * ${theme.spacing(0.5)})`,
                    },
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            {Array.from({ length: Math.floor(level) }, (_, i) => (
                <Box
                    key={i}
                    sx={{
                        //  Indentation blocks (same width as icons)
                        position: "absolute",
                        left: (i - 0.5) * ICON_SIZE - 0.5 + "px",
                        display: "flex",
                        width: ICON_SIZE + "px",
                        height: "100%",

                        borderRight: "1px solid #495057",

                        // Mobile styling show stacked lines
                        [theme.breakpoints.down("laptop")]: {
                            //left: -ICON_SIZE + 2 * i + "px",
                            left: -ICON_SIZE + "px",
                            borderRight: `2px solid hsl(210deg, 8.75%,
                                ${Math.max(100 - (MAX_LEVEL - level) * 15, 30)}%)`,
                            // height: "200%",
                            // bottom: 0,
                        },
                    }}
                />
            ))}

            {children}
        </Box>
    );
}

/**Shows the percentage of the best match and its source */
function Chips({ folder }: { folder: Folder }) {
    if (!folder.is_album) {
        return <Box />;
    }

    return (
        <Box
            display="flex"
            alignItems="center"
            className="chip"
            sx={(theme) => ({
                position: "relative",
                gap: 0.5,
                [theme.breakpoints.down("tablet")]: {
                    gap: 1,
                },
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",

                [theme.breakpoints.up("tablet")]: {
                    "> div": {
                        // Feels a bit hacky, but is the only way how to do align
                        // the chips without adding more grid columns
                        minWidth: "4.2rem",
                    },
                },
            })}
        >
            <BestCandidateChip folder={folder} />
            <HashMismatchChip folder={folder} />
            <DuplicateChip folder={folder} />
            <FolderStatusChip folder={folder} />
        </Box>
    );
}

/* --------------------------------- Utility --------------------------------- */

export function InboxGridHeader({
    inboxFolderConfig,
}: {
    inboxFolderConfig: ReturnType<typeof useInboxFolderConfig>;
}) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const [checked, setChecked] = useState(false);
    const { nSelected, deselectAll } = useFolderSelectionContext();
    const { config: inboxFolderGridConfig, setGridTemplateColumns } =
        useInboxFolderGridConfig(inboxFolderConfig.path);

    return (
        <GridRow>
            <Checkbox
                color="secondary"
                indeterminate={nSelected > 0}
                className="selector"
                sx={{
                    margin: 0,
                    padding: 0,
                }}
                checked={checked}
                onChange={() => {
                    deselectAll();
                    setChecked(false);
                }}
                disabled={nSelected === 0}
            />
            <Box className="tree" sx={{ display: "flex", alignItems: "center" }}>
                <Typography
                    fontSize={12}
                    variant="body2"
                    sx={{ color: "text.secondary" }}
                >
                    {nSelected} folder{nSelected > 1 ? "s" : null} selected
                </Typography>
            </Box>

            <Box
                className="actions"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                }}
            >
                <IconButton
                    onClick={() => setOpen(true)}
                    sx={{
                        color: "text.secondary",
                    }}
                >
                    <Settings size={16} />
                </IconButton>
                <Dialog
                    open={open}
                    onClose={() => setOpen(false)}
                    title={`${inboxFolderConfig.name} settings`}
                    title_icon={<Settings size={theme.iconSize.xl} />}
                    color="secondary"
                >
                    <DialogContent>
                        <Alert
                            severity="info"
                            sx={{
                                width: "min-content",
                                minWidth: "100%",
                                marginBottom: 2,
                            }}
                        >
                            <AlertTitle>Settings are not persistent</AlertTitle>
                            <Box sx={{ minWidth: "100%" }}>
                                At the moment, all settings are only applied to the
                                current browser and are saved in local storage. We might
                                add persistent settings in the future.
                            </Box>
                        </Alert>

                        <GridTemplateSettings
                            inboxFolderGridConfig={inboxFolderGridConfig}
                            setGridTemplateColumns={setGridTemplateColumns}
                        />
                        <ActionSettings />
                    </DialogContent>
                </Dialog>
            </Box>
        </GridRow>
    );
}

function ActionSettings() {
    const dragging = useRef<HTMLDivElement | null>(null);
    const [primaryActions, setPrimaryActions] = useState<string[]>(["p1", "p2"]);
    const [secondaryActions, setSecondaryActions] = useState<string[]>([]);

    const [actions, setActions] = useState(["retag", "delete", "import"]);

    function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        e.stopPropagation();

        // Get positions within the element
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const y = e.clientY - rect.top;

        const draggedAction = e.dataTransfer.getData("text/plain");
        const dragStartIndex = actions.indexOf(draggedAction);

        const newIndex = Math.floor((y / target.clientHeight) * actions.length);

        if (dragStartIndex === -1 && dragStartIndex !== newIndex) {
            console.warn("Dragged action not found in actions list");
            return;
        }

        setActions((prevActions) => {
            const newActions = [...prevActions];
            // Remove the dragged action from its old position
            const ele = newActions.splice(dragStartIndex, 1);
            newActions.splice(newIndex, 0, ...ele);
            // Insert the dragged action at the new position
            return [...newActions];
        });
    }

    function handleDragEnd() {
        if (dragging.current) {
            dragging.current.style.opacity = "1"; // Reset opacity after drag ends
            dragging.current = null;
        }
    }
    function handleDragStart(e: React.DragEvent<HTMLDivElement>, action: string) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.dropEffect = "move";
        e.dataTransfer.setData("text/plain", action);

        // Set style to indicate dragging
        dragging.current = e.currentTarget;
        dragging.current.style.opacity = "0.5";

        window.addEventListener("dragend", handleDragEnd, { once: true });
    }

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 1,
            }}
        >
            <Typography
                variant="h6"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Change the <em>primary</em> and <em>secondary</em> actions that can be
                applied to the selected folders. Depending on the order of the actions,
                the first action will be shown as a button, the rest will be in a
                dropdown menu.
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    paddingBlock: 2,
                    position: "relative",
                }}
                onDragOver={handleDragOver}
            >
                {actions.map((action) => (
                    <Box
                        width="100%"
                        key={action}
                        border="1px solid #ccc"
                        draggable
                        onDragStart={(e) => handleDragStart(e, action)}
                        sx={{
                            //Highlight on dragging
                            "&:hover": {
                                borderColor: "secondary.main",
                                cursor: "move",
                            },
                            paddingInline: 1,
                        }}
                    >
                        {action}
                    </Box>
                ))}
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    width: "100%",
                    gap: 2,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <Typography variant="h6">Primary actions</Typography>
                    <Box
                        sx={{
                            minHeight: "2.5rem",
                            border: "1px solid",
                            borderColor: "secondary.main",
                            borderRadius: 1,
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        {primaryActions.map((action) => (
                            <StyledChip
                                key={action}
                                label={action}
                                onDelete={() =>
                                    setPrimaryActions((prev) =>
                                        prev.filter((a) => a !== action)
                                    )
                                }
                                color="secondary"
                                draggable
                                onDragStart={(e) => handleDragStart(e, action)}
                                sx={{
                                    margin: "0.25rem",
                                    cursor: "move",
                                }}
                            />
                        ))}
                    </Box>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <Typography variant="h6">Secondary actions</Typography>
                    <Box
                        sx={{
                            minHeight: "2.5rem",
                            border: "1px dashed",
                            borderColor: "secondary.main",
                            borderRadius: 1,
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        {secondaryActions.map((action) => (
                            <StyledChip
                                key={action}
                                label={action}
                                onDelete={() =>
                                    setSecondaryActions((prev) =>
                                        prev.filter((a) => a !== action)
                                    )
                                }
                                draggable
                                onDragStart={(e) => handleDragStart(e, action)}
                                sx={{
                                    margin: "0.25rem",
                                    cursor: "move",
                                }}
                            />
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
