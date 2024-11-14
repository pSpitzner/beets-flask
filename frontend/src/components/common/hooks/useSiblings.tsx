// we want to be able to modify a componenents siblings.
// e.g. rightclicking on a tag in the tag list should allow us to expand all tags in the same group.

import React, { Context, createContext, MutableRefObject, useCallback, useContext, useRef } from "react";


interface SiblingRefsContextType<SibType> {
    siblingsRef: MutableRefObject<Map<string, SibType>>;
    register: (id: string, sib: SibType) => void;
    unregister: (id: string) => void;
    callOnSiblings: (callable: (sib: SibType) => void) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SiblingRefsContext = createContext<SiblingRefsContextType<any>>({
    siblingsRef: {
        current: new Map()
    },
    register: () => { },
    unregister: () => { },
    callOnSiblings: () => { },
});

function SiblingRefsProvider<SibType>({ children }: { children: React.ReactNode }) {
    const siblingsRef = useRef<Map<string, SibType>>(new Map());

    const register = useCallback((id: string, sib: SibType) => {
        siblingsRef.current.set(id, sib);
    }, []);

    const unregister = useCallback((id: string) => {
        siblingsRef.current.delete(id);
    }, []);

    const callOnSiblings = useCallback(
        (callable: (sib: SibType, id?: string) => void) => {
            siblingsRef.current.forEach((child, key) => {
                callable(child, key);
            });
        },
        []
    );

    return (
        <SiblingRefsContext.Provider
            value={{ register, unregister, callOnSiblings, siblingsRef }}
        >
            {children}
        </SiblingRefsContext.Provider>
    );
}

function useSiblings<SibType>() {
    const context = useContext<SiblingRefsContextType<SibType>>(SiblingRefsContext as Context<SiblingRefsContextType<SibType>>);
    if (!context) {
        throw new Error("useSiblings must be used within a SiblingRefsProvider");
    }
    return context
}

export { SiblingRefsProvider, useSiblings };
export type { SiblingRefsContextType };
