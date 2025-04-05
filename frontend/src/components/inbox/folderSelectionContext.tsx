import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { Folder } from "@/pythonTypes";

/* --------------------------------- Context -------------------------------- */
// Allows to trigger actions on a single or multiple folders

export interface FolderSelectionContext {
    nSelected: number;
    selected: {
        hashes: Array<Folder["hash"]>;
        paths: Array<Folder["full_path"]>;
    };
    toggleSelect(folder: Folder): void;
    isSelected(folder: Folder): boolean;
    deselectAll(): void;
}

const FoldersContext = createContext<FolderSelectionContext | null>(null);

export function useFolderSelectionContext() {
    const context = useContext(FoldersContext);
    if (!context) {
        throw new Error("useFoldersContext must be used inside a FoldersProvider");
    }
    return context;
}

export function FolderSelectionProvider({ children }: { children: React.ReactNode }) {
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
