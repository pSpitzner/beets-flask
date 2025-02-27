import {
    Badge,
    Box,
    Button,
    Checkbox,
    Chip,
    IconButton,
    SxProps,
    Theme,
    Tooltip,
    Typography,
} from "@mui/material";
import { File, Folder } from "@/pythonTypes";
import { createContext, useCallback, useContext, useState } from "react";
import {
    Disc3,
    FileIcon,
    FolderIcon,
    LucideChevronRight,
    LucideProps,
    Music,
} from "lucide-react";
import { JSONPretty } from "../common/json";
import { PenaltyIcon } from "../import/icons";

/* --------------------------------- Context -------------------------------- */
// Allows to trigger actions on a single or multiple folders

interface FolderContext {
    nSelected: number;
    toggleSelect(folder: Folder): void;
    isSelected(folder: Folder): boolean;
}

const foldersContext = createContext<FolderContext | null>(null);

function useFoldersContext() {
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
                {folder.is_album ? (
                    <Disc3 size={ICON_SIZE} />
                ) : (
                    <FolderIcon size={ICON_SIZE} />
                )}
                <Typography
                    variant="body1"
                    sx={{ fontSize: "1rem", marginRight: "auto" }}
                >
                    {folder.full_path.split("/").pop()}
                </Typography>

                {/* Current best match */}
                <PenaltyIcon kind="artist" color="red" />
                <PenaltyIcon kind="track" color="orange" />
                <PenaltyIcon kind="duplicate" />
                <IconButton sx={{ padding: 0 }} disableRipple>
                    <Chip
                        label={(Math.random() * 100).toFixed() + "%"}
                        color="success"
                        size="small"
                        sx={{
                            minWidth: "3rem",
                            justifyContent: "flex-end",
                            alignItems: "center",
                        }}
                    />
                </IconButton>

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

function FileTypeIcon({
    type,
    ...props
}: { type: string | undefined } & React.ComponentProps<typeof Music>) {
    switch (type) {
        case "mp3":
        case "flac":
        case "wav":
        case "ogg":
            return <Music {...props} />;
        default:
            return <FileIcon {...props} />;
    }
}

function ColWrapper({
    children,
    sx,
}: {
    children: React.ReactNode;
    sx?: SxProps<Theme>;
}) {
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
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}

/* --------------------------------- Header --------------------------------- */

export function SelectedStats() {
    const { nSelected } = useFoldersContext();
    return <Box>{nSelected} folders selected</Box>;
}
