// TODO: get them from backend beets: beets.config["match"]["strong_rec_thresh"]
const strong_rec_thresh = 0.04;
const medium_rec_thresh = 0.25;

import "./similarityBadge.scss";

export function SimilarityBadge({
    dist,
    className,
}: {
    dist: null | number;
    className?: string;
}) {
    if (dist === null) {
        return (
            <span className={`${className} SimilarityBadge tbd `}>tbd</span>
        );
    }

    const sim = `${Math.floor((1 - dist) * 100)}%`;
    if (dist <= strong_rec_thresh) {
        return <span className={`${className} SimilarityBadge strong`}>{sim}</span>;
    } else if (dist <= medium_rec_thresh) {
        return <span className={`${className} SimilarityBadge medium`}>{sim}</span>;
    } else {
        return <span className={`${className} SimilarityBadge weak`}>{sim}</span>;
    }
}
