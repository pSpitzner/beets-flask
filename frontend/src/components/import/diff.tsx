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
    const [didRemove, setRemoved] = useState<boolean>(false);
    const [didAdd, setAdded] = useState<boolean>(false);

    useEffect(() => {
        // eslint-disable-next-line
        let diff = Diff.diffChars(one, other) as DiffPart[];
        // diffChars diffWords diffWordsWithSpace
        // simple heuristics: if we have a lot to replaceme, maybe a word diff is better
        if (diff.length > one.length / 2) {
            // eslint-disable-next-line
            const wordDiff = Diff.diffWords(one, other) as DiffPart[];
            if (0.75 * wordDiff.length < diff.length) {
                diff = wordDiff;
            }
        }
        console.log("diff", diff);
        const leftParts: JSX.Element[] = [];
        const rightParts: JSX.Element[] = [];
        let wasAdded = false;
        let wasRemoved = false;

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
                wasAdded = true;
            } else if (part.removed) {
                leftParts.push(span);
                wasRemoved = true;
            } else {
                leftParts.push(span);
                rightParts.push(span);
            }
        });

        setLeft(leftParts);
        setRight(rightParts);
        setAdded(wasAdded);
        setRemoved(wasRemoved);
    }, [one, other]);

    return { left, right, didRemove, didAdd };
}
