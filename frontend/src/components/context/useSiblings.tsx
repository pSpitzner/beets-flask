// we want to be able to modify a componenents siblings.
// e.g. rightclicking on a tag in the tag list should allow us to expand all tags in the same group.

import React, { createContext, useCallback, useContext, useRef } from "react";

type SiblingRefsContextType = {
    siblings: React.RefObject<any>[];
    registerSibling: (ref: React.RefObject<any>) => void;
    callOnSiblings: (callable: (ref: React.RefObject<any>) => void) => void;
};

const SiblingRefsContext = createContext<SiblingRefsContextType>({
    siblings: [],
    registerSibling: () => {},
    callOnSiblings: () => {},
});

const SiblingRefsProvider = ({ children }: { children: React.ReactNode }) => {
    const refs = useRef<React.RefObject<any>[]>([]);

    const registerSibling = useCallback((ref: any) => {
        if (ref && !refs.current.includes(ref)) {
            refs.current.push(ref);
        }
    }, []);

    const callOnSiblings = useCallback(
        (callable: (ref: React.RefObject<any>) => void) => {
            refs.current.forEach((childRef) => {
                if (childRef.current) {
                    callable(childRef.current);
                }
            });
        },
        []
    );

    return (
        <SiblingRefsContext.Provider
            value={{ registerSibling, callOnSiblings, siblings: refs.current }}
        >
            {children}
        </SiblingRefsContext.Provider>
    );
};

const useSiblings = () => {
    const context = useContext(SiblingRefsContext);
    if (!context) {
        throw new Error("useSiblings must be used within a SiblingRefsProvider");
    }
    return context;
};

export { SiblingRefsProvider, useSiblings };
export type { SiblingRefsContextType };
