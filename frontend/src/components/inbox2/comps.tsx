import { Disc3, FolderIcon, ImportIcon, LucideChevronRight, TagIcon } from "lucide-react";
import { createContext, MouseEvent, useCallback, useContext, useState } from "react";
import {
    Box,
    Checkbox,
    Chip,
    IconButton,
    SpeedDial,
    SpeedDialAction,
    SpeedDialActionProps,
    SpeedDialIcon,
    SpeedDialProps,
    SxProps,
    Theme,
    Typography,
    useMediaQuery,
} from "@mui/material";

import { File, Folder } from "@/pythonTypes";

import { FileTypeIcon, SourceTypeIcon } from "../common/icons";
import { PenaltyIcon } from "../import/icons";

/* --------------------------------- Context -------------------------------- */
// Allows to trigger actions on a single or multiple folders

interface FolderContext {
    nSelected: number;
    selectedHash: Folder["hash"][];
    toggleSelect(folder: Folder): void;
    isSelected(folder: Folder): boolean;
    deselectAll(): void;
}

const foldersContext = createContext<FolderContext | null>(null);

export function useFoldersContext() {
    const context = useContext(foldersContext);
    if (!context) {
        throw new Error("useFoldersContext must be used inside a FoldersProvider");
    }
    return context;
}

export function FoldersSelectionProvider({ children }: { children: React.ReactNode }) {
    // we do not need to store the selected folders directly but can
    // derive them from their selected hashes, this is more or less an id for folders
    const [selectedHash, setSelectedHash] = useState<Folder["hash"][]>([]);

    const toggleSelect = (folder: Folder) => {
        setSelectedHash((selectedHash) => {
            if (selectedHash.includes(folder.hash)) {
                return selectedHash.filter((hash) => hash !== folder.hash);
            } else {
                return [...selectedHash, folder.hash];
            }
        });
    };

    const isSelected = useCallback(
        (folder: Folder) => selectedHash.includes(folder.hash),
        [selectedHash]
    );

    const deselectAll = () => setSelectedHash([]);

    const nSelected = selectedHash.length;

    return (
        <foldersContext.Provider
            value={{ nSelected, toggleSelect, isSelected, selectedHash, deselectAll }}
        >
            {children}
        </foldersContext.Provider>
    );
}

/* ---------------------------- Folder & File component ---------------------------- */

const ICON_SIZE = 20;
const INDENT = 5;

export function FolderComponent({ folder }: { folder: Folder }) {
    const [isOpen, setIsOpen] = useState(true);
    const { isSelected, toggleSelect } = useFoldersContext();

    // Create children elements from tree (recursive)
    const childElements = Object.entries(folder.children).map(([_key, values]) => {
        if (values.type === "file") {
            return <FileComponent file={values} key={values.full_path} />;
        } else if (values.type === "directory") {
            return <FolderComponent folder={values} key={values.hash} />;
        }
    });

    return (
        <ColWrapper>
            <RowWrapper isSelected={isSelected(folder)}>
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
                {/* Folder name */}
                {folder.is_album ? <Disc3 size={ICON_SIZE} /> : <FolderIcon size={ICON_SIZE} />}
                <Typography variant="body1" sx={{ fontSize: "1rem", marginRight: "auto" }}>
                    {folder.full_path.split("/").pop()}
                </Typography>

                {/* Current best match including penalties */}
                <PenaltyIcon kind="artist" color="red" />
                <PenaltyIcon kind="track" color="orange" />
                <PenaltyIcon kind="duplicate" />
                <MatchChip type="spotify" quality={100} />

                {/* Selector */}
                <Checkbox
                    size="medium"
                    checked={isSelected(folder)}
                    onChange={() => toggleSelect(folder)}
                    style={{ padding: 0 }}
                />
            </RowWrapper>

            {/* Children */}
            <ColWrapper
                sx={{
                    position: "relative",
                    display: isOpen ? "flex" : "none",
                    // Align border with icon
                    marginLeft: ICON_SIZE / 2 - 0.5 + "px",
                    paddingLeft: INDENT + "px",
                    borderLeft: "1px solid #495057;",
                }}
            >
                {childElements}
            </ColWrapper>
        </ColWrapper>
    );
}

function FileComponent({ file }: { file: File }) {
    // Infer type from file ending
    const type = file.full_path.split(".").pop();

    return (
        <RowWrapper
            sx={{
                marginLeft: ICON_SIZE + INDENT + "px",
                fontSize: "0.7rem",
                fontFamily: "monospace",
                color: "#999",
                "&:after": {
                    content: '""',
                    position: "absolute",
                    display: "block",
                    width: ICON_SIZE + "px",
                    left: -ICON_SIZE - 2 * INDENT + "px",
                    borderBottom: "1px solid #495057",
                },
            }}
        >
            <FileTypeIcon type={type} size={ICON_SIZE * 0.7} />
            <Typography variant="body1">{file.full_path.split("/").pop()}</Typography>
        </RowWrapper>
    );
}

function ColWrapper({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}

function RowWrapper({
    children,
    isSelected,
    sx,
}: {
    children: React.ReactNode;
    isSelected?: boolean;
    sx?: SxProps<Theme>;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "0.5rem",
                background: isSelected ? "gray" : "transparent",
                paddingBlock: "1px",
                position: "relative",
                flexWrap: "wrap",
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}

/**Shows the percentage of the best match and its source */
function MatchChip({ type, quality }: { type: string; quality: number }) {
    return (
        <Chip
            icon={<SourceTypeIcon type={type} />}
            label={quality.toFixed() + "%"}
            size="small"
            color="success"
            sx={{
                minWidth: "4.5rem",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: quality_color(quality),
            }}
        />
    );
}
function quality_color(quality: number) {
    const h = 355 + (125 * quality) / 100;
    const s = 130 - (60 * quality) / 100;
    const l = 45 + Math.abs(0.5 - quality / 100) * 30;
    return "hsl(" + h + ", " + s + "%, " + l + "%)";
}

/* --------------------------------- Utility --------------------------------- */

export function SelectedStats() {
    const { nSelected } = useFoldersContext();
    return <Typography fontSize={12}>{nSelected} folders selected</Typography>;
}

/* --------------------------------- Actions -------------------------------- */
// Actions a user can take on a single or multiple folders implemented as speed dial

export function FolderActions() {
    const [open, setOpen] = useState(false);
    const { nSelected, selectedHash, deselectAll } = useFoldersContext();

    function onReTag(e: MouseEvent<HTMLDivElement>) {
        console.log("Retagging on ", selectedHash);
        setOpen(false);
        setTimeout(() => {
            deselectAll();
        }, 1000);
    }

    function onAutoImport(e: MouseEvent<HTMLDivElement>) {
        console.log("Auto-importing on ", selectedHash);
        setOpen(false);
        deselectAll();
    }

    // Show speed dial only once something is selected
    if (nSelected === 0) {
        return null;
    }

    return (
        <GenericSpeedDial
            ariaLabel="FolderAction"
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
        >
            <GenericSpeedDialAction icon={<TagIcon />} tooltip="Retag" onClick={onReTag} />
            <GenericSpeedDialAction
                icon={<ImportIcon />}
                tooltip="Auto-import"
                onClick={onAutoImport}
            />
        </GenericSpeedDial>
    );
}

/* --------------------------- Speeddial generics --------------------------- */
// We might want to move this into common

export function GenericSpeedDial(props: SpeedDialProps) {
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
            {...props}
        />
    );
}

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
