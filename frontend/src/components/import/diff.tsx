import * as Diff from "diff";
import { useEffect, useState } from "react";

import styles from "./import.module.scss";

export function useDiff(one: string, other: string) {
    const [left, setLeft] = useState<React.ReactNode[]>([]);
    const [right, setRight] = useState<React.ReactNode[]>([]);
    const [didRemove, setRemoved] = useState<boolean>(false);
    const [didAdd, setAdded] = useState<boolean>(false);

    useEffect(() => {
        let diff = Diff.diffChars(one, other);

        // simple heuristics: if we have a lot to replaceme, maybe a word diff is better
        if (diff.length > one.length / 2) {
            const wordDiff = Diff.diffWords(one, other);
            if (0.75 * wordDiff.length < diff.length) {
                diff = wordDiff;
            }
        }
        console.log("diff", diff);
        const leftParts: React.ReactNode[] = [];
        const rightParts: React.ReactNode[] = [];
        let wasAdded = false;
        let wasRemoved = false;

        diff.forEach((part, index) => {
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
