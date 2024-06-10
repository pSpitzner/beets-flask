import Tab, { tabClasses } from "@mui/material/Tab";
import Tabs, { tabsClasses } from "@mui/material/Tabs";
import { styled } from "@mui/material/styles";
import { Home, Inbox, Tag, Library } from "lucide-react";
import { createLink, useRouterState } from "@tanstack/react-router";

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
    // TODO:
    const location = useRouterState({ select: (s) => s.location })
    return (
        <Tabs
            textColor="inherit"
            value={location.pathname}
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
            <TabItem value={"/"} disableRipple
                 label={"Home"} icon={<Home />} to="/"/>
            <TabItem value={"/inbox"} disableRipple label={"Inbox"} icon={<Inbox />} to="/inbox" />
            <TabItem value={"/tagGroup"} disableRipple label={"Tags"} icon={<Tag />} to="/tagGroup" />
            <TabItem value={"/library"} disableRipple label={"Library"} icon={<Library />} to="/library" activeOptions={{exact: false}}/>
        </Tabs>
    );
}
