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
    forwardRef,
    useEffect,
    useImperativeHandle,
    useState,
} from "react";
import { useSelection } from "@/components/context/useSelection";
import {
    CollapseAllAction,
    ContextMenu,
    ExpandAllAction,
    defaultActions,
} from "./contextMenu";
import { useSiblings } from "@/components/context/useSiblings";
import { useConfig } from "@/components/context/useConfig";
import { TagStatusIcon } from "./statusIcon";

const StyledTagAccordion = styled(Accordion)(({ theme }) => ({
    // borderTop: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    // background: theme.palette.background.default,
    "&:before": {
        display: "none",
    },
    "&:hover": {
        background: theme.palette.action.hover,
        borderRadius: theme.shape.borderRadius,
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
        // borderTop: `1px dashed ${theme.palette.divider}`,
        padding: "0.4rem 0 1rem 1rem",
        margin: "0rem 1rem 0.5rem 1rem",
        borderRadius: theme.shape.borderRadius,
        background: "#1E1F20",
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
        const config = useConfig();
        const [expanded, setExpanded] = useState<boolean>(config.gui.tags.expand_tags);
        const handleSelect = (event: React.MouseEvent) => {
            if (event.metaKey || event.ctrlKey) {
                if (data) toggleSelection(data.album_folder);
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
            if (data?.album_folder) markSelectable(data?.album_folder);
        }, [markSelectable, data?.album_folder]);

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
                <StyledTagAccordion disableGutters disabled>
                    <AccordionSummary>{inner}</AccordionSummary>
                </StyledTagAccordion>
            );
        }

        return (
            <ContextMenu
                identifier={data.album_folder}
                actions={[
                    <ExpandAllAction />,
                    <CollapseAllAction />,
                    ...defaultActions,
                ]}
            >
                <StyledTagAccordion
                    disableGutters
                    key={identifier}
                    className={styles.accordionOuter}
                    data-selected={isSelected(data.album_folder)}
                    expanded={expanded}
                    onClick={handleSelect}
                >
                    <AccordionSummary
                        aria-controls="tag-content"
                        expandIcon={<Ellipsis size={"0.9rem"} />}
                        onClick={handleExpand}
                        className={styles.header}
                    >
                        <div className={styles.albumIcons}>
                            <TagStatusIcon
                                className={styles.albumIcon}
                                tagPath={tagPath}
                                tagId={tagId}
                            />
                            <SimilarityBadge dist={data.distance} />
                        </div>
                        <Typography fontSize={"0.9rem"}>
                            {data.album_folder_basename}
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <TagPreview tagId={tagId} tagPath={tagPath} />
                    </AccordionDetails>
                </StyledTagAccordion>
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
