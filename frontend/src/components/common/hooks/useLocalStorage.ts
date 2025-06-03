import { useCallback, useEffect, useState } from "react";

type InitialValue<T> = T | (() => T);

function getInitialValue<T>(initialValue: InitialValue<T>): T {
    if (typeof initialValue === "function") {
        return (initialValue as () => T)();
    }
    return initialValue;
}
/** Allows to persist a value in local storage
 *
 * see https://reactlevelup.com/posts/use-local-storage
 */
export const useLocalStorage = <T>(
    key: string,
    initialValue: InitialValue<T>
): [T, (value: T) => void, () => void] => {
    // Check if there is a value in `localStorage` for the given `key`
    const [value, setValue] = useState<T>(getStorageValue<T>(key, initialValue));

    // Function to set value in `localStorage`,
    // `useCallback` is used to memoize the function to prevent
    // recreation of the function instance when `key` doesn't change
    const setLocalStorageValue = useCallback(
        (newValue: T) => {
            try {
                setValue(newValue);
                localStorage.setItem(key, JSON.stringify(newValue));

                // Dispatch a `storage` event to notify other tabs

                window.dispatchEvent(
                    new StorageEvent("storage", {
                        key,
                        newValue: JSON.stringify(newValue),
                    })
                );
            } catch (error) {
                console.error("Error saving value to `localStorage`:", error);
            }
        },
        [key]
    );

    // Function to remove value from `localStorage`,
    // `useCallback` is used for the same reason as above
    const removeLocalStorageValue = useCallback(() => {
        setValue(initialValue);
        localStorage.removeItem(key);
    }, [initialValue, key]);

    // `useEffect` is used to subscribe to changes in the `localStorage` made by other tabs,
    // and it depends on the `key` to listen for changes relevant to this specific key.
    // If the `key` changes, `useEffect` will run again to update the subscription for the new key
    useEffect(() => {
        const updateAllTabs = (event: StorageEvent) => {
            // Check if the changed `event.key` matches the current `key` and `newValue` is not `null`
            if (event.key === key && event.newValue !== null) {
                // Update the state with the new value from `localStorage`
                setValue(JSON.parse(event.newValue) as T);
            }
        };

        // Add event listener for `storage` events
        window.addEventListener("storage", updateAllTabs);
        // Cleanup function to remove event listener when component unmounts
        return () => {
            window.removeEventListener("storage", updateAllTabs);
        };
    }, [key]); // `useEffect` depends on the `key` to subscribe to changes relevant to this `key`

    return [value, setLocalStorageValue, removeLocalStorageValue]; // Re-run `useEffect` only when any of these values change
};

export function getStorageValue<T>(key: string, initialValue: InitialValue<T>): T {
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue) return JSON.parse(storedValue) as T;
        return getInitialValue(initialValue);
    } catch (error) {
        console.error("Error retrieving value from `localStorage`:", error);
        return getInitialValue(initialValue);
    }
}
