import React from "react";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import { ChevronDown } from "lucide-react";

const StyledAccordion = styled(Accordion)(({ theme }) => ({
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    "&:before": {
        display: "none",
    },
    "& .MuiAccordionSummary-root": {
        "&:hover": {
            background: theme.palette.action.hover,
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
    [key: string]: any;
}) {
    const renderTitle = (title: React.ReactNode | string, subtitle?: string) => {
        if (typeof title === "string") {
            return (
                <div className="flex items-center gap-2">
                    <Typography variant="h6">
                        {title}
                    </Typography>
                    {subtitle && <Typography className="opacity-50">{subtitle}</Typography>}
                </div>
            );
        } else {
            return title;
        }
    };
    return (
        <StyledAccordion
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
            <AccordionDetails>{children}</AccordionDetails>
        </StyledAccordion>
    );
}
