import { Download, Home, Inbox, Library, Search, Tag } from "lucide-react";
import { ReactElement } from "react";
import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Tab, { tabClasses, TabProps } from "@mui/material/Tab";
import Tabs, { tabsClasses } from "@mui/material/Tabs";
import { createLink, LinkProps, useRouterState } from "@tanstack/react-router";

interface StyledTabProps extends Omit<LinkProps, "children">, Omit<TabProps, "ref"> {
    label: string | ReactElement;
}

const StyledTab = createLink(
    styled(Tab)<StyledTabProps>(({ theme }) => ({
        lineHeight: "inherit",
        minHeight: 32,
        marginTop: 8,
        minWidth: 0,
        flexDirection: "row",
        letterSpacing: "1px",
        justifyContent: "center",
        gap: "0.5rem",
        textTransform: "uppercase",
        "& svg": {
            fontSize: 16,
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

const TabLabel = styled(Typography)(({ theme }) => ({
    marginLeft: 8,
    lineHeight: "12px",
    [theme.breakpoints.down("md")]: {
        marginLeft: 0,
        display: "none",
    },
}));

function NavItem({ label, ...props }: StyledTabProps) {
    return <StyledTab label={<TabLabel>{label}</TabLabel>} disableRipple {...props} />;
}

export default function NavTabs() {
    const location = useRouterState({ select: (s) => s.location });
    let basePath = location.pathname.split("/")[1];

    // only needed temporarily until search gets an icon in the toolbar!
    if (basePath === "library") {
        basePath += "/" + location.pathname.split("/")[2];
    }

    const navItems = [
        { label: "Home", icon: <Home />, to: "/" as const },
        { label: "Inbox", icon: <Inbox />, to: "/inbox" as const },
        { label: "Tags", icon: <Tag />, to: "/tags" as const },
        { label: "Import", icon: <Download />, to: "/import" as const },
        { label: "Library", icon: <Library />, to: "/library/browse" as const },
        { label: "Search", icon: <Search />, to: "/library/search" as const },
    ];

    const currentIdx = navItems.findIndex((item) => item.to === "/" + basePath);

    return (
        <Tabs
            textColor="inherit"
            value={currentIdx === -1 ? false : currentIdx}
            sx={{
                boxShadow: "inset 0 1px 0 0 #efefef",
                backgroundColor: "background.paper",
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
            {navItems.map((item) => (
                <NavItem key={item.to} {...item} />
            ))}
        </Tabs>
    );
}
