import { Disc3, FolderIcon, LucideChevronRight } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { Box, Checkbox, Chip, IconButton, SxProps, Theme, Typography } from "@mui/material";

import { File, Folder } from "@/pythonTypes";

import { FileTypeIcon, SourceTypeIcon } from "../common/icons";
import { PenaltyIcon } from "../import/icons";

/* --------------------------------- Context -------------------------------- */
// Allows to trigger actions on a single or multiple folders

interface FolderContext {
    nSelected: number;
    toggleSelect(folder: Folder): void;
    isSelected(folder: Folder): boolean;
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

    const nSelected = selectedHash.length;

    return (
        <foldersContext.Provider value={{ nSelected, toggleSelect, isSelected }}>
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
    var h = 355 + (125 * quality) / 100;
    var s = 130 - (60 * quality) / 100;
    var l = 45 + Math.abs(0.5 - quality / 100) * 30;
    return "hsl(" + h + ", " + s + "%, " + l + "%)";
}

/* --------------------------------- Header --------------------------------- */

export function SelectedStats() {
    const { nSelected } = useFoldersContext();
    return <Box>{nSelected} folders selected</Box>;
}
