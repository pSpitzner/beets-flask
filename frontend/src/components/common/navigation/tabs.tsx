import Tab, { tabClasses } from "@mui/material/Tab";
import Tabs, { tabsClasses } from "@mui/material/Tabs";
import { styled } from "@mui/material/styles";
import { Home, Inbox } from "lucide-react";
import { useState } from "react";
import { createLink } from "@tanstack/react-router";

/**
 * Custom styled component for a tab item.
 *
 * I just found we can style mui coponents
 * like this. I like it!
 *
 * @param {object} theme - The theme object.
 * @returns {JSX.Element} - The styled TabItem component.
 */
const TabItem = createLink(
    styled(Tab)(({ theme }) => ({
        lineHeight: "inherit",
        minWidth: 0,
        flexDirection: "row",
        letterSpacing: "1px",
        justifyContent: "center",
        gap: "0.5rem",
        textTransform: "uppercase",
        "& svg": {
            fontSize: 16,
            marginRight: 8,
            width: 16,
            height: 16,
        },
        "&:not(:last-child)": {
            marginRight: 24,
            [theme.breakpoints.up("sm")]: {
                marginRight: 60,
            },
        },
        [theme.breakpoints.up("md")]: {
            minWidth: 0,
        },
        [`& .${tabClasses.labelIcon}`]: {
            minHeight: 53,
        },
        [`& .${tabClasses.iconWrapper}`]: {
            marginBottom: 0,
        },
    }))
);

/** Minimal tabs with dark background
 * and a white border at the top which
 * indicates the active tab.
 */
export default function NavTabs() {
    const [tabIndex, setTabIndex] = useState(0);
    return (
        <Tabs
            textColor="inherit"
            value={tabIndex}
            onChange={(_, index: number) => setTabIndex(index)}
            sx={{
                boxShadow: "inset 0 1px 0 0 #efefef",
                overflow: "visible",
                [`& .${tabsClasses.indicator}`]: {
                    bottom: "unset",
                    top: 0,
                    height: "1px",
                    backgroundColor: "background.paper",
                },
                [`& .${tabsClasses.flexContainer}`]: {
                    justifyContent: "center",
                },
            }}
        >
            <TabItem disableRipple label={"Home"} icon={<Home />} to="/" />
            <TabItem disableRipple label={"Inbox"} icon={<Inbox />} to="/inbox" />
            <TabItem disableRipple label={"Other"} />
            <TabItem disableRipple label={"Stuff"} />
        </Tabs>
    );
}
