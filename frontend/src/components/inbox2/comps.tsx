import { Box, Checkbox, IconButton, SxProps, Theme } from "@mui/material";
import { File, Folder } from "@/pythonTypes";
import { createContext, useCallback, useContext, useState } from "react";
import { LucideChevronRight, Music } from "lucide-react";
import { JSONPretty } from "../common/json";

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
                <IconButton
                    onClick={() => setIsOpen(!isOpen)}
                    size="small"
                    sx={{ padding: "0px", margin: "0px" }}
                >
                    <LucideChevronRight
                        style={{
                            transform: isOpen ? "rotate(90deg)" : "",
                            transition: "transform 0.15s ease-in-out",
                        }}
                    />
                </IconButton>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        marginRight: "auto",
                    }}
                >
                    {folder.full_path}
                </Box>
                <Checkbox
                    size="medium"
                    checked={isSelected(folder)}
                    onChange={() => toggleSelect(folder)}
                    style={{ padding: 0 }}
                />
            </RowWrapper>
            {isOpen && (
                <ColWrapper sx={{ marginLeft: "28px" }}>{childElements}</ColWrapper>
            )}
        </ColWrapper>
    );
}

function FileComponent({ file }: { file: File }) {
    return (
        <RowWrapper>
            <Music size={20} strokeWidth={"4px"} />
            {file.full_path}
        </RowWrapper>
    );
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
                ...sx,
                display: "flex",
                flexDirection: "column",
            }}
        >
            {children}
        </Box>
    );
}

function RowWrapper({
    children,
    isSelected,
}: {
    children: React.ReactNode;
    isSelected?: boolean;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "4px",
                background: isSelected ? "gray" : "transparent",
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
