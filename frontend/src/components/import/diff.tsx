// eslint-disable-next-line
// @ts-nocheck
import * as Diff from "diff";
import { useEffect, useState } from "react";

import styles from "./import.module.scss";

interface DiffPart {
    added?: boolean;
    removed?: boolean;
    value: string;
}

export function useDiff(one: string, other: string) {
    const [left, setLeft] = useState<JSX.Element[]>([]);
    const [right, setRight] = useState<JSX.Element[]>([]);

    useEffect(() => {
        // eslint-disable-next-line
        const diff = Diff.diffChars(one, other) as DiffPart[]; // diffChars diffWords diffWordsWithSpace
        const leftParts: JSX.Element[] = [];
        const rightParts: JSX.Element[] = [];

        diff.forEach((part: DiffPart, index: number) => {
            const className = part.added
                ? styles.added
                : part.removed
                  ? styles.removed
                  : "";
            const span = (
                <span key={index} className={className}>
                    {part.value}
                </span>
            );

            if (part.added) {
                rightParts.push(span);
            } else if (part.removed) {
                leftParts.push(span);
            } else {
                leftParts.push(span);
                rightParts.push(span);
            }
        });

        setLeft(leftParts);
        setRight(rightParts);
    }, [one, other]);

    return { left, right };
}
