import { ChevronDown } from "lucide-react";
import React, { ComponentProps } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import { SelectionProvider } from "@/components/common/hooks/useSelection";

const StyledGroupAccordion = styled(Accordion)(({ theme }) => ({
    // border: `1px solid ${theme.palette.divider}`,
    // background: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    "&:before": {
        display: "none",
    },
    "& .MuiAccordionSummary-root": {
        "&:hover": {
            background: theme.palette.action.hover,
            borderRadius: theme.shape.borderRadius,
        },
    },
    "& .MuiAccordionDetails-root": {
        padding: "0",
    },
    "& .MuiAccordionDetails-root > .MuiAccordion-rounded": {
        borderTopLeftRadius: "0",
        borderTopRightRadius: "0",
    },
}));

/**
 * A group of tags with a title and optional subtitle.
 * subtitle is only used if title is a string.
 */
export default function TagGroupView({
    children,
    title,
    subtitle,
    ...props
}: {
    title: React.ReactNode | string;
    subtitle?: string;
    children: React.ReactNode;
} & ComponentProps<typeof StyledGroupAccordion>) {
    return (
        <StyledGroupAccordion
            disableGutters
            slotProps={{ transition: { unmountOnExit: true } }}
            {...props}
        >
            <AccordionSummary
                expandIcon={<ChevronDown />}
                aria-controls="tag-group-content"
                id="tag-group-header"
            >
                {renderTitle(title, subtitle)}
            </AccordionSummary>
            <AccordionDetails>
                <SelectionProvider>{children}</SelectionProvider>
            </AccordionDetails>
        </StyledGroupAccordion>
    );
}

function renderTitle(
    title: React.ReactNode | string,
    subtitle?: string
): React.ReactNode {
    if (typeof title === "string") {
        return (
            <div className="flex items-center gap-2">
                <Typography variant="h6">{title}</Typography>
                {subtitle && <Typography className="opacity-50">{subtitle}</Typography>}
            </div>
        );
    } else {
        return <span>{title}</span>;
    }
}
