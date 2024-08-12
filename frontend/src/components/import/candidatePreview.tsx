// for now we only display the beets generated text preview.

import Ansi from "@curvenote/ansi-to-react";

import { CandidateChoice } from "./context";

import styles from "./import.module.scss";

export function CandidatePreview({ candidate }: { candidate: CandidateChoice }) {
    const content = candidate.diff_preview ?? "No preview available";
    return (
        <div className={styles.candidatePreview}>
            <Ansi useClasses>{content}</Ansi>
        </div>
    );
}
