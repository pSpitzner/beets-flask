import { useQuery } from "@tanstack/react-query";
import Ansi from "@curvenote/ansi-to-react";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import { styled } from "@mui/material/styles";
import styles from "./tagView.module.scss";

import { tagQueryOptions } from "@/lib/tag";
import { APIError } from "@/lib/fetch";
import { SimilarityBadge } from "./similarityBadge";
import { Typography } from "@mui/material";
import { Ellipsis } from "lucide-react";
import {
    createRef,
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { useSelection } from "@/components/context/useSelection";
import {
    CollapseAllAction,
    ContextMenu,
    ExpandAllAction,
    SelectionSummary,
    defaultActions,
} from "./contextMenu";
import { useSiblings } from "@/components/context/useSiblings";

const StyledAccordion = styled(Accordion)(({ theme }) => ({
    borderTop: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    background: theme.palette.background.default,
    "&:before": {
        display: "none",
    },
    "&:hover": {
        background: theme.palette.action.hover,
    },
    '&[data-selected="true"]': {
        background: theme.palette.action.selected,
    },
    "& .MuiAccordionSummary-root": {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "0",
        padding: "0 1.25rem 0 0.4rem",
    },
    "& .MuiAccordionSummary-content": {
        gap: "0.4rem",
        margin: "0.4rem",
    },
    "& .MuiAccordionDetails-root": {
        borderTop: `1px dashed ${theme.palette.divider}`,
        padding: "0.4rem 0 1rem 1rem",
    },
    "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
        transform: "rotate(90deg)",
    },
}));

export const TagView = forwardRef(
    ({ tagId, tagPath }: { tagId?: string; tagPath?: string }, ref) => {
        if (!tagId && !tagPath) {
            throw new Error("TagView requires either a tagId or tagPath");
        }
        const identifier: string = tagId ?? tagPath!;
        const { data, isLoading, isPending, isError } = useQuery(
            tagQueryOptions(tagId, tagPath)
        );
        const { isSelected, toggleSelection, markSelectable } = useSelection();
        const { registerSibling } = useSiblings();
        const [expanded, setExpanded] = useState<boolean>(false);
        const handleSelect = (event: React.MouseEvent) => {
            if (event.metaKey || event.ctrlKey) {
                toggleSelection(identifier);
                event.stopPropagation();
                event.preventDefault();
            }
        };
        const handleExpand = (event: React.MouseEvent) => {
            if (event.metaKey || event.ctrlKey) {
                return;
            } else {
                setExpanded(!expanded);
            }
        };

        useEffect(() => {
            registerSibling(ref as React.RefObject<any>);
        }, [registerSibling, ref]);

        useEffect(() => {
            markSelectable(identifier);
        }, [markSelectable, identifier]);

        // expose setExpanded to the outside
        useImperativeHandle(ref, () => ({
            setExpanded: (state: boolean) => {
                setExpanded(state);
            },
        }));

        if (isLoading || isPending || isError) {
            let inner = "";
            if (isLoading) inner = "Loading...";
            if (isPending) inner = "Pending...";
            if (isError) inner = "Error...";
            return (
                <StyledAccordion disableGutters disabled>
                    <AccordionSummary>{inner}</AccordionSummary>
                </StyledAccordion>
            );
        }

        return (
            <ContextMenu actions={[<ExpandAllAction />, <CollapseAllAction />]}>
                <StyledAccordion
                    disableGutters
                    key={identifier}
                    className={styles.accordionOuter}
                    data-selected={isSelected(identifier)}
                    expanded={expanded}
                    onClick={handleSelect}
                >
                    <AccordionSummary
                        aria-controls="tag-content"
                        expandIcon={<Ellipsis size={"0.9rem"} />}
                        onClick={handleExpand}
                    >
                        <SimilarityBadge dist={data.distance} />
                        <Typography fontSize={"0.9rem"}>
                            {data.album_folder_basename}
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <TagPreview tagId={tagId} tagPath={tagPath} />
                    </AccordionDetails>
                </StyledAccordion>
            </ContextMenu>
        );
    }
);

export const TagPreview = ({
    tagId,
    tagPath,
}: {
    tagId?: string;
    tagPath?: string;
}) => {
    const { data, isLoading, isPending, isError, error } = useQuery(
        tagQueryOptions(tagId, tagPath)
    );

    if (isLoading || isPending) {
        return <div className={styles.tagPreview}>Loading...</div>;
    }
    if (isError && error instanceof APIError) {
        return <div className={styles.tagPreview}>APIError...</div>;
    } else if (isError) {
        return <div className={styles.tagPreview}>Error...</div>;
    }

    const content = data.preview ?? "...";

    return (
        <div className={styles.tagPreview}>
            <Ansi useClasses>{content}</Ansi>
        </div>
    );
};
