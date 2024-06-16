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

export default function TagGroupView({ children, title }: {
    title: React.ReactNode | string;
    children: React.ReactNode }) {

    const renderTitle = (title : React.ReactNode | string) => {
        if (typeof title === "string") {
            return <Typography variant="h6">{title}</Typography>;
        } else {
            return title;
        }
    };
    return (
        <StyledAccordion
            defaultExpanded
            disableGutters
            slotProps={{ transition: { unmountOnExit: true } }}
        >
            <AccordionSummary
                expandIcon={<ChevronDown />}
                aria-controls="tag-group-content"

                id="tag-group-header"
            >
                {renderTitle(title)}
            </AccordionSummary>
            <AccordionDetails>{children}</AccordionDetails>
        </StyledAccordion>
    );
}
