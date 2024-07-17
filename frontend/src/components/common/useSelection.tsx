// in various places we need to make a selection of tags available to lower components,
// e.g. to action multiple tags at the same time via the context menu.

import { createContext, useCallback, useContext, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { TagI } from "@/components/common/_query";

interface SelectionContextType {
    selection: Map<string, boolean>;
    setSelection: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
    addToSelection: (item: string) => void;
    removeFromSelection: (item: string) => void;
    toggleSelection: (item: string) => boolean;
    clearSelection: () => void;
    isSelected: (item: string) => boolean;
    numSelected: () => number;
    getSelected: () => string[];
    markSelectable: (item: string) => void;
    selectAll: () => void;
    deselectAll: () => void;
}

const SelectionContext = createContext<SelectionContextType>({
    selection: new Map(),
    setSelection: () => {},
    addToSelection: () => {},
    removeFromSelection: () => {},
    toggleSelection: () => false,
    clearSelection: () => {},
    isSelected: () => false,
    numSelected: () => 0,
    getSelected: () => [],
    markSelectable: () => {},
    selectAll: () => {},
    deselectAll: () => {},
});

export const SelectionProvider = ({ children }: { children: React.ReactNode }) => {
    // item to selected
    const [selection, setSelection] = useState<Map<string, boolean>>(new Map());

    const addToSelection = useCallback((item: string) => {
        setSelection((s) => {
            s.set(item, true);
            console.log("added", item);
            return new Map(s);
        });
    }, []);

    // because we have a map, the selection can serve two purposes:
    // 1. keeping an overview of what can be selected / actioned
    // 2. toggeling selection on and off
    const markSelectable = useCallback((item: string) => {
        setSelection((s) => {
            if (!s.has(item)) {
                s.set(item, false);
                return new Map(s);
            } else {
                return s;
            }
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelection((s) => {
            s.forEach((_, key) => s.set(key, true));
            return new Map(s);
        });
    }, []);

    const deselectAll = useCallback(() => {
        setSelection((s) => {
            s.forEach((_, key) => s.set(key, false));
            return new Map(s);
        });
    }, []);

    const removeFromSelection = useCallback((item: string) => {
        setSelection((s) => {
            s.set(item, false);
            console.log("removed", item);
            return new Map(s);
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelection(new Map());
    }, []);

    const isSelected = useCallback(
        (item: string) => selection.get(item) ?? false,
        [selection]
    );

    const numSelected = () => {
        let count = 0;
        selection.forEach((selected) => {
            if (selected) {
                count++;
            }
        });
        return count;
    };

    const getSelected = () => {
        return Array.from(selection)
            .filter(([, value]) => value)
            .map(([selectedKey]) => selectedKey);
    };

    const toggleSelection = (item: string) => {
        if (isSelected(item)) {
            removeFromSelection(item);
            return false;
        } else {
            addToSelection(item);
            return true;
        }
    };

    return (
        <SelectionContext.Provider
            value={{
                selection,
                setSelection,
                addToSelection,
                removeFromSelection,
                toggleSelection,
                clearSelection,
                isSelected,
                numSelected,
                getSelected,
                markSelectable,
                selectAll,
                deselectAll,
            }}
        >
            <>{children}</>
        </SelectionContext.Provider>
    );
};

export const useSelection = () => {
    const context = useContext(SelectionContext);
    if (!context) {
        throw new Error("useSelection must be used within a SelectionProvider");
    }
    return context;
};

export interface SelectionLookupI {
    query: string; // the queried folder
    tag?: TagI;
    is_tagged: boolean;
    is_inbox: boolean;
    is_deleted: boolean;
    is_album_folder: boolean;
}

export function useSelectionLookupQueries(fullPaths: string[]) {
    const queries = fullPaths.map((path) => ({
        queryKey: ["lookup", path],
        queryFn: async () => {
            if (path.startsWith("/")) path = path.slice(1);
            const response = await fetch(`/lookup/${path}`);
            return (await response.json()) as SelectionLookupI;
        },
    }));

    return useQueries({ queries });
}
