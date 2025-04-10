import { LucideChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import {
    Box,
    Checkbox,
    IconButton,
    styled,
    SxProps,
    Theme,
    Typography,
    useTheme,
} from "@mui/material";
import { Link } from "@tanstack/react-router";

import { File, Folder } from "@/pythonTypes";

import {
    DeleteAllImportedFolderButton,
    MoreActions,
    RefreshAllFoldersButton,
} from "./actions";
import { useFolderSelectionContext } from "./folderSelectionContext";

import { BestCandidateChip, DuplicateChip, FolderStatusChip } from "../common/chips";
import { FileTypeIcon, FolderTypeIcon } from "../common/icons";
import useMobileSafeContextMenu from "../common/hooks/useMobileSafeContextMenu";

/* ------------------------------ Grid wrapper ------------------------------ */

export const GridWrapper = styled(Box)(({ theme }) => ({
    display: "grid",
    // gridTemplateColumns: "[tree] 1fr [chip] auto [actions] auto [selector] auto",
    gridTemplateColumns: "[selector] auto [tree] 1fr [chip] auto [actions] auto ",
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
}));

const GridRow = styled(Box)({
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
    gridAutoFlow: "column dense",
    alignItems: "center",
});

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

    // Getting a context menu to work is a bit tricky
    // on mobile devices, so we use a custom hook
    // to handle the context menu events on long press
    // we also want to allow to trigger the menu using a button
    // for this we use a element as anchor
    const [contextMenuAnchor, setContextMenuAnchor] = useState<
        | {
              top: number;
              left: number;
          }
        | HTMLElement
        | null
    >(null);
    const mobileSafeContext = useMobileSafeContextMenu((e) => {
        e.preventDefault();

        setContextMenuAnchor(
            contextMenuAnchor === null
                ? {
                      top: e.clientY + 2,
                      left: e.clientX - 6,
                  }
                : // repeated contextmenu when it is already open closes it with Chrome 84 on Ubuntu
                  // Other native context menus might behave different.
                  // With this behavior we prevent contextmenu from the backdrop to re-locale existing context menus.
                  null
        );

        // Prevent text selection lost after opening the context menu on Safari and Firefox
        const selection = document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            setTimeout(() => {
                selection.addRange(range);
            });
        }
    }, 500);

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
            {/* Current best match including penalties */}
            {/* TODO: Generate with best candidate */}
            <GridRow
                sx={(theme) => ({
                    paddingInline: theme.spacing(0.5),
                    borderRadius: 1,
                    position: "relative",
                    "&:hover, &[data-contextmenu='true']": {
                        backgroundColor: theme.palette.action.hover + " !important",
                    },
                    "&[data-selected='true']": {
                        backgroundColor: theme.palette.action.selected + " !important",
                    },
                })}
                data-selected={isSelected(folder)}
                data-contextmenu={Boolean(contextMenuAnchor)}
                onClick={() => toggleSelect(folder)}
                {...mobileSafeContext}
            >
                <Chips folder={folder} />

                {/* Folder name and collapsable */}
                <FolderTreeRow
                    folder={folder}
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    level={level}
                />
                {/* More actions*/}
                <MoreActions
                    f={folder}
                    anchor={contextMenuAnchor}
                    setAnchor={setContextMenuAnchor}
                    sx={{ gridColumn: "actions" }}
                />

                {/* Selector */}
                <Checkbox
                    sx={{
                        gridColumn: "selector",
                    }}
                    size="medium"
                    checked={isSelected(folder)}
                    style={{ padding: 0 }}
                    disabled={unSelectable}
                />
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
    const whiteness = Math.max(100 - (MAX_LEVEL - level) * 15, 30);
    return (
        <LevelIndentWrapper
            level={level}
            sx={{
                gridColumn: "tree",
                color: `hsl(210deg, 8.75%, ${whiteness}%)`,
            }}
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
                    paddingLeft: `calc(${level} * ${theme.spacing(0.5)})`,
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
            sx={(theme) => ({
                gridColumn: "chip",
                position: "relative",
                gap: 0.5,
                [theme.breakpoints.down("tablet")]: {
                    gap: 1,
                },
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",

                "> div": {
                    // Feels a bit hacky, but is the only way how to do align
                    // the chips without adding more grid columns
                    minWidth: "4.2rem",
                },
            })}
        >
            <DuplicateChip folder={folder} />
            <BestCandidateChip folder={folder} />
            <FolderStatusChip folder={folder} />
        </Box>
    );
}

/* --------------------------------- Utility --------------------------------- */

export function SelectedStats() {
    const { nSelected } = useFolderSelectionContext();

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
            <RefreshAllFoldersButton />
            <DeleteAllImportedFolderButton />
            <Typography fontSize={12} sx={{ marginLeft: "auto" }}>
                {nSelected} folder{nSelected > 1 ? "s" : null} selected
            </Typography>
        </Box>
    );
}
