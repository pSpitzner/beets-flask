import { useCallback, useMemo, useState } from "react";

/**
 * A custom React hook that manages a list of items with a "current" state,
 * allowing navigation (next/prev), addition, and clearing of items.
 *
 * @template T - The type of items in the list.
 * @param {T[] | (() => T[])} [initialState=[]] - Initial list of items or a function that returns it.
 */
export function useNavigableList<T>(initialState: T[] | (() => T[]) = []) {
    const [items, setItems] = useState<T[]>(initialState);
    const [currentIndex, setCurrentIndex] = useState<number | null>(null);

    // Memoized currentItem to prevent recalculations
    const currentItem = useMemo(() => {
        if (currentIndex === null) return null;
        if (currentIndex >= items.length) return null;
        return items[currentIndex];
    }, [currentIndex, items]);

    /** Navigates to the next or previous item in the list.
     *
     * This function updates the current index to the next or previous item
     * in the list, depending on the direction provided.
     */
    const navigate = useCallback(
        (direction: 1 | -1) => {
            if (currentIndex === null) return null;
            const newIndex = currentIndex + direction;
            if (newIndex < 0 || newIndex >= items.length) return null;
            setCurrentIndex(newIndex);
            return items[newIndex];
        },
        [currentIndex, items]
    );

    /**
     * Adds a new item to the list
     */
    const add = useCallback(
        (newItems: T | T[]) => {
            newItems = Array.isArray(newItems) ? newItems : [newItems];
            setItems((prev) => [...prev, ...newItems]);

            if (currentIndex === null) {
                setCurrentIndex(0);
            }
        },
        [items.length]
    );

    /**
     * Clears all items and resets the current index.
     */
    const clear = useCallback(() => {
        setItems([]);
        setCurrentIndex(null);
    }, []);

    /**
     * Sets the current index to a specific value.
     */
    const setCurrentItem = useCallback(
        (item: T | null) => {
            if (item === null) {
                setCurrentIndex(null);
                return;
            }
            const index = items.indexOf(item);
            if (index !== -1) {
                setCurrentIndex(index);
            } else {
                console.warn("Item not found in the list");
            }
        },
        [items]
    );

    return {
        items,
        setItems,
        currentIndex,
        setCurrentIndex,
        currentItem,
        setCurrentItem,
        navigate,
        add,
        clear,
        hasNext: currentIndex !== null && currentIndex < items.length - 1,
        hasPrev: currentIndex !== null && currentIndex > 0,
    };
}
