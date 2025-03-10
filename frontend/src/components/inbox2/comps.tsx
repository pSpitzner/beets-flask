import {
    CopyIcon,
    EllipsisVerticalIcon,
    ImportIcon,
    LucideChevronRight,
    RefreshCwIcon,
    TagIcon,
    Trash2Icon,
} from "lucide-react";
import {
    createContext,
    forwardRef,
    MouseEvent,
    Ref,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import {
    Box,
    Checkbox,
    Chip,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    SpeedDial,
    SpeedDialAction,
    SpeedDialActionProps,
    SpeedDialIcon,
    SpeedDialProps,
    styled,
    SxProps,
    Theme,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
    Zoom,
} from "@mui/material";

import { File, Folder } from "@/pythonTypes";

import { FileTypeIcon, SourceTypeIcon, FolderTypeIcon } from "../common/icons";
import { useMutation } from "@tanstack/react-query";
import { ClipboardCopyButton } from "../common/buttons/copy";

/* --------------------------------- Context -------------------------------- */
// Allows to trigger actions on a single or multiple folders

interface FolderContext {
    nSelected: number;
    selected: {
        hashes: Array<Folder["hash"]>;
        paths: Array<Folder["full_path"]>;
    };
    toggleSelect(folder: Folder): void;
    isSelected(folder: Folder): boolean;
    deselectAll(): void;
}

const FoldersContext = createContext<FolderContext | null>(null);

export function useFoldersContext() {
    const context = useContext(FoldersContext);
    if (!context) {
        throw new Error("useFoldersContext must be used inside a FoldersProvider");
    }
    return context;
}

export function FoldersSelectionProvider({ children }: { children: React.ReactNode }) {
    // we do not need to store the selected folders directly but can
    // derive them from their selected hashes and paths, this is more or less an id for folders
    const [selected, setSelected] = useState<{
        hashes: Folder["hash"][];
        paths: Folder["full_path"][];
    }>({ hashes: [], paths: [] });

    useEffect(() => {
        console.debug("FoldersSelectionProvider", "selected", selected);
    }, [selected]);

    const toggleSelect = (folder: Folder) => {
        setSelected((selected) => {
            if (selected.hashes.includes(folder.hash)) {
                const idx = selected.hashes.indexOf(folder.hash);

                selected.paths.splice(idx, 1);
                selected.hashes.splice(idx, 1);
                return {
                    hashes: selected.hashes,
                    paths: selected.paths,
                };
            } else {
                return {
                    hashes: [...selected.hashes, folder.hash],
                    paths: [...selected.paths, folder.full_path],
                };
            }
        });
    };

    const isSelected = useCallback(
        (folder: Folder) => selected.hashes.includes(folder.hash),
        [selected]
    );

    const deselectAll = () => setSelected({ hashes: [], paths: [] });

    const nSelected = selected.hashes.length;

    return (
        <FoldersContext.Provider
            value={{ nSelected, toggleSelect, isSelected, selected, deselectAll }}
        >
            {children}
        </FoldersContext.Provider>
    );
}

/* ------------------------------ Grid wrapper ------------------------------ */

export const GridWrapper = styled(Box)({
    display: "grid",
    gridTemplateColumns: "[chip] auto [tree] 1fr [actions] auto [selector] auto",
    width: "100%",
    columnGap: "1rem",
    // Fill columns even if content is given in other order
    // Fill columns even if content is given in other order
    gridAutoFlow: "dense",

    // Add zebra striping
    "> div:nth-of-type(odd)": {
        background: `linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.01) 0%,
            rgba(0, 0, 0, 0.2) 50%,
            rgba(0, 0, 0, 0.01) 100%
        )`,
    },
});

const GridRow = styled(Box)({
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
    gridAutoFlow: "dense",
    alignItems: "center",
});

/* ---------------------------- Folder & File component ---------------------------- */

const ICON_SIZE = 20;

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
    const { isSelected, toggleSelect } = useFoldersContext();

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
            {/* Current best match including penalties */}
            {/* TODO: Generate with best candidate */}
            <GridRow
                sx={{
                    backgroundColor: isSelected(folder) ? "gray !important" : "inherit",
                    position: "relative",
                }}
            >
                <MatchChip
                    type="spotify"
                    quality={100}
                    sx={{ gridColumn: "chip", justifyContent: "center" }}
                />
                {/* Folder name and collapsable */}
                <FolderTreeRow
                    folder={folder}
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    level={level}
                />

                {/* Selector */}
                <Checkbox
                    sx={{
                        gridColumn: "selector",
                    }}
                    size="medium"
                    checked={isSelected(folder)}
                    onChange={() => toggleSelect(folder)}
                    style={{ padding: 0 }}
                    disabled={unSelectable}
                />
                {/* More actions*/}
                <MoreActions f={folder} />
            </GridRow>

            {/* Children */}
            {isOpen && childElements}
        </>
    );
}

function FileComponent({ file, level = 0 }: { file: File; level?: number }) {
    return (
        <GridRow>
            <FileName file={file} level={level} />
            {/* Emtpy grid items for alignment */}
            <Box sx={{ gridColumn: "chip", minWidth: 0 }} />
            <Box sx={{ gridColumn: "selector", minWidth: 0 }} />
        </GridRow>
    );
}

function FolderTreeRow({
    folder,
    isOpen,
    setIsOpen,
    level = 0,
}: {
    folder: Folder;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    level?: number;
}) {
    return (
        <LevelIndentWrapper
            level={level}
            sx={{
                gridColumn: "tree",
            }}
        >
            {/* Collapse/Expand button */}
            <IconButton
                onClick={() => setIsOpen(!isOpen)}
                size="small"
                sx={{ padding: "0px", margin: "0px", marginRight: "-2px" }}
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

            <Typography variant="body1">{folder.full_path.split("/").pop()}</Typography>
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
            sx={{
                fontSize: "0.7rem",
                fontFamily: "monospace",
                color: "#999",
                gridColumnStart: "tree",
                gridColumnEnd: "-1", // Allow full size
                minWidth: "0",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    left: ICON_SIZE / 2 - 0.5 + ICON_SIZE * (level - 1) + "px",
                    width: ICON_SIZE + "px",
                    height: "1px",
                    backgroundColor: "#495057",
                    flexShrink: 0,

                    // Mobile styling
                    [theme.breakpoints.down("laptop")]: {
                        visibility: "hidden",
                    },
                }}
            ></Box>
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
        </LevelIndentWrapper>
    );
}

function LevelIndentWrapper({
    children,
    sx,
    level = 0,
}: {
    children: React.ReactNode;
    sx?: SxProps<Theme>;
    level?: number;
}) {
    const theme = useTheme();

    return (
        <Box
            sx={{
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
                    paddingLeft: "0px",
                },
                ...sx,
            }}
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
                            left: -ICON_SIZE - 2 * i + "px",
                            borderRight: `1px solid hsl(210deg, 8.75%, ${30 + i * 15}%)`,
                        },
                    }}
                />
            ))}

            {children}
        </Box>
    );
}

/**Shows the percentage of the best match and its source */
function MatchChip({
    type,
    quality,
    sx,
}: {
    type: string;
    quality: number;
    sx?: SxProps<Theme>;
}) {
    return (
        <Chip
            icon={<SourceTypeIcon type={type} size={ICON_SIZE} />}
            label={quality.toFixed() + "%"}
            size="small"
            color="success"
            sx={{
                minWidth: "4.5rem",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: quality_color(quality),
                ...sx,
                fontSize: "0.8rem",
            }}
        />
    );
}

function quality_color(quality: number) {
    const h = 355 + (125 * quality) / 100;
    const s = 130 - (60 * quality) / 100;
    const l = 45 + Math.abs(0.5 - quality / 100) * 30;
    return "hsl(" + h + ", " + s + "%, " + l + "%) !important";
}

/* --------------------------------- Utility --------------------------------- */

export function SelectedStats() {
    const { nSelected } = useFoldersContext();

    return (
        <Box
            sx={{
                display: "flex",
                gap: "1rem",
                alignItems: "flex-end",
                justifyContent: "flex-start",
                width: "100%",
            }}
        >
            <RefreshFolders />
            <DeleteAllImported />
            <Typography fontSize={12} sx={{ marginLeft: "auto" }}>
                {nSelected} folder{nSelected > 1 ? "s" : null} selected
            </Typography>
        </Box>
    );
}

/* --------------------------------- Actions -------------------------------- */
// Actions a user can take on a single or multiple folders implemented as speed dial

export function FolderActions() {
    const [open, setOpen] = useState(false);
    const { nSelected, selected, deselectAll } = useFoldersContext();
    const theme = useTheme();

    function onReTag(e: MouseEvent<HTMLDivElement>) {
        console.log("Retagging on ", selected);
        setOpen(false);
        setTimeout(() => {
            deselectAll();
        }, 1000);
    }

    function onAutoImport(e: MouseEvent<HTMLDivElement>) {
        console.log("Auto-importing on ", selected);
        setOpen(false);
        deselectAll();
    }

    function onDelete(e: MouseEvent<HTMLDivElement>) {
        console.log("Deleting ", selected);
        setOpen(false);
        deselectAll();
    }

    // Show speed dial only once something is selected
    // This is done via zoom component
    const transitionDuration = {
        enter: theme.transitions.duration.enteringScreen,
        exit: theme.transitions.duration.leavingScreen,
    };

    return (
        <Zoom
            in={nSelected > 0}
            timeout={transitionDuration.enter}
            style={{
                transitionDelay: `${nSelected > 0 ? transitionDuration.exit : 0}ms`,
                // FIXME: Transform origin should be centered on button not bottom right
                // not sure if this is easily doable tho
                transformOrigin: "bottom right",
            }}
            unmountOnExit
        >
            <GenericSpeedDial
                ariaLabel="FolderAction"
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
            >
                <GenericSpeedDialAction
                    icon={<TagIcon />}
                    tooltip="Retag"
                    onClick={onReTag}
                />
                <GenericSpeedDialAction
                    icon={<ImportIcon />}
                    tooltip="Auto-import"
                    onClick={onAutoImport}
                />
                <GenericSpeedDialAction
                    icon={<Trash2Icon />}
                    tooltip={`Delete ${nSelected} folder${nSelected > 1 ? "s" : ""}!`}
                    onClick={onAutoImport}
                />
            </GenericSpeedDial>
        </Zoom>
    );
}

function RefreshFolders() {
    // See inbox2 route
    const { mutate, isPending } = useMutation({
        mutationKey: ["refreshInbox2Tree"],
    });

    return (
        <Tooltip title="Refresh folders">
            <IconButton
                onClick={() => mutate()}
                sx={{
                    animation: isPending ? "spin 1s linear infinite" : "none",
                    "@keyframes spin": {
                        from: { transform: "rotate(0deg)" },
                        to: { transform: "rotate(360deg)" },
                    },
                }}
                disabled={isPending}
            >
                <RefreshCwIcon size={ICON_SIZE} />
            </IconButton>
        </Tooltip>
    );
}

function DeleteAllImported() {
    return (
        <Tooltip title="Delete all imported albums">
            <IconButton>
                <Trash2Icon size={ICON_SIZE} />
            </IconButton>
        </Tooltip>
    );
}

/* --------------------------- Speed dial generics -------------------------- */
// We might want to move this into common namespace

const GenericSpeedDial = forwardRef(function GenericSpeedDial(
    props: SpeedDialProps,
    ref: Ref<HTMLDivElement>
) {
    // speed dial opens left on big screens
    const isLaptopUp = useMediaQuery((theme) => theme.breakpoints.up("laptop"));

    return (
        <SpeedDial
            color="primary"
            icon={<SpeedDialIcon />}
            direction={isLaptopUp ? "left" : undefined}
            sx={(theme) => {
                return {
                    position: "absolute",
                    bottom: theme.spacing(1),
                    right: theme.spacing(1),
                    [theme.breakpoints.up("laptop")]: {
                        position: "relative",
                        display: "flex",
                        bottom: "0",
                        right: "0",
                    },
                };
            }}
            ref={ref}
            {...props}
        />
    );
});

function GenericSpeedDialAction({
    icon,
    tooltip,
    ...props
}: { icon: React.ReactNode; tooltip: string } & SpeedDialActionProps) {
    // In theory we should check for touch instead of a breakpoint but tbh
    // im too lazy to figure out how to do that properly
    const isMobile = !useMediaQuery((theme) => theme.breakpoints.up("laptop"));

    return (
        <SpeedDialAction
            icon={icon}
            slotProps={{
                tooltip: {
                    // show tooltips always on mobile devices
                    open: isMobile ?? undefined,
                    title: tooltip,
                },
                staticTooltipLabel: {
                    sx: (theme) => ({
                        right: "3.5rem",
                        whiteSpace: "nowrap",
                        [theme.breakpoints.up("laptop")]: {
                            bottom: "1.5rem",
                            right: "0",
                            display: "flex",
                        },
                    }),
                },
            }}
            {...props}
        />
    );
}

/** Simple context menu with some items */
function MoreActions({ f }: { f: Folder | File }) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    return (
        <>
            <IconButton
                onClick={(e) => {
                    setAnchorEl(e.currentTarget);
                }}
                sx={{ padding: "0px", margin: "0px" }}
                disableRipple
            >
                <EllipsisVerticalIcon size={ICON_SIZE} />
            </IconButton>
            <Menu
                onClose={() => setAnchorEl(null)}
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
            >
                <MenuItem
                    onClick={() => {
                        // copy full path to clipboard
                        navigator.clipboard.writeText(f.full_path);
                        setAnchorEl(null);
                    }}
                >
                    <ClipboardCopyButton
                        text={f.full_path}
                        icon_props={{
                            size: ICON_SIZE,
                        }}
                        sx={{
                            margin: 0,
                            display: "flex",
                            gap: "0.5rem",
                            fontSize: "1rem",
                            padding: "0",
                        }}
                    >
                        Copy Path
                    </ClipboardCopyButton>
                </MenuItem>
            </Menu>
        </>
    );
}
