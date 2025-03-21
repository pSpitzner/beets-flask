import { Box } from "@mui/material";

import styles from "./loading.module.scss";

interface LoadingProps {
    noteColor?: string;
    shadowColor?: string;
}

export function Loading({ noteColor, shadowColor }: LoadingProps) {
    return (
        <Box
            className={styles.notes}
            sx={
                {
                    "--note-color": noteColor,
                    "--shadow-color": shadowColor,
                } as React.CSSProperties
            }
        >
            <Note />
            <Note />
            <Note />
        </Box>
    );
}

export function LoadingSmall({ noteColor, shadowColor }: LoadingProps) {
    return (
        <Box
            className={styles.notes}
            sx={
                {
                    "--note-color": noteColor,
                    "--shadow-color": shadowColor,
                } as React.CSSProperties
            }
        >
            <Note size="small" />
        </Box>
    );
}

function Note({ size = "normal" }: { size?: "normal" | "small" }) {
    return (
        <div className={styles.note} data-size={size}>
            <div className={styles.noteIcon}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="100%"
                    height="100%"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <circle cx="8" cy="18" r="4" />
                    <path d="M12 18V2l7 4" />
                </svg>
            </div>
        </div>
    );
}

export function GrowingRipple({
    size,
    color,
}: {
    size?: string | number;
    color?: string;
}) {
    return (
        <Box
            sx={{
                color: color || "inherit",
                display: "inline-block",
                position: "relative",
                width: size,
                height: size,

                div: {
                    position: "absolute",
                    border: "2px solid currentColor",
                    borderRadius: "50%",
                    animation: "ripple 3s cubic-bezier(0, 0.2, 0.8, 1) infinite",
                },

                "div:nth-of-type(2)": {
                    animationDelay: "-1s",
                },

                "@keyframes ripple": {
                    "0%, 50%": {
                        top: "50%",
                        left: "50%",
                        width: 0,
                        height: 0,
                        opacity: 0,
                    },
                    "90%": {
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0.7,
                    },

                    "100%": {
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                    },
                },
            }}
        >
            <div />
            <div />
        </Box>
    );
}
