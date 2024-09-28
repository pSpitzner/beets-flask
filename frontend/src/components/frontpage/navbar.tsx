import { HardDriveDownload, Home, Inbox, Library, Search, Tag } from "lucide-react";
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
        marginTop: 7,
        minHeight: 32,
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
        [theme.breakpoints.up("md")]: {
            minWidth: 0,
        },
        [`& .${tabClasses.labelIcon}`]: {
            minHeight: 53,
        },
        [`& .${tabClasses.icon}`]: {
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
        { label: "Import", icon: <HardDriveDownload />, to: "/import" as const },
        { label: "Library", icon: <Library />, to: "/library/browse" as const },
        { label: "Search", icon: <Search />, to: "/library/search" as const },
    ];

    const currentIdx = navItems.findIndex((item) => item.to === "/" + basePath);

    return (
        <Tabs
            textColor="inherit"
            value={currentIdx === -1 ? false : currentIdx}
            sx={(theme) => ({
                overflow: "hidden",
                display: "flex",
                width: "100%",
                justifyContent: "center",
                [`& .${tabsClasses.indicator}`]: {
                    bottom: "unset",
                    top: "16px",
                    height: "15px",
                    filter: "blur(25px)",
                    backgroundColor: "#ffffff88",
                    overflow: "visible",
                },
                [`& .MuiTabs-scroller`]: {
                    width: "100%",
                    overflow: "visible",
                },
                // Spacing of tabs for different breakpoints
                [`& .MuiTabs-flexContainer`]: {
                    width: "100%",
                    gap: "24px",
                    justifyContent: "center",
                    [theme.breakpoints.up("md")]: {
                        gap: "30px",
                    },
                },
            })}
        >
            {navItems.map((item) => (
                <NavItem key={item.to} {...item} />
            ))}
        </Tabs>
    );
}
