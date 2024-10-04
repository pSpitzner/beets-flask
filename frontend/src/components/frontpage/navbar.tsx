import {
    HardDriveDownload,
    Home,
    Inbox,
    Library,
    Search,
    Tag,
    Terminal,
} from "lucide-react";
import { MouseEvent, ReactElement, useRef } from "react";
import { Box, darken, Typography, useTheme } from "@mui/material";
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
        overflow: "visible",
        transition: "color 0.3s linear",
        "& svg": {
            fontSize: 16,
            width: 16,
            height: 16,
        },
        [theme.breakpoints.up(960)]: {
            minWidth: 0,
        },
        [`& .${tabClasses.labelIcon}`]: {
            minHeight: 53,
        },
        [`& .${tabClasses.icon}`]: {
            marginBottom: 0,
        },
        [`&:hover`]: {
            color: darken(theme.palette.secondary.main, 0.2),
            transition: "color 1s linear, text-shadow 5s ease-in",
            textShadow: `0 0 50px ${theme.palette.secondary.main}`,
        },
        [`&[data-status="active"]`]: {
            color: theme.palette.secondary.main,
        },
    }))
);

const TabLabel = styled(Typography)(({ theme }) => ({
    marginLeft: 8,
    lineHeight: "12px",
    [theme.breakpoints.down(960)]: {
        marginLeft: 0,
        display: "none",
    },
}));

function NavItem({ label, ...props }: StyledTabProps) {
    // @ts-expect-error: WTF is happening here. MUI-Update broke typing!
    return <StyledTab label={<TabLabel>{label}</TabLabel>} disableRipple {...props} />;
}

export default function NavTabs() {
    const theme = useTheme();
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
        {
            label: "",
            icon: <Terminal stroke={theme.palette.primary.main} />,
            to: "/terminal" as const,
        },
    ];

    const currentIdx = navItems.findIndex((item) => item.to === "/" + basePath);
    const ref = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: MouseEvent) => {
        ref.current?.style.setProperty("--mouse-x", `${e.clientX}px`);
        ref.current?.style.setProperty("--mouse-y", `${e.clientY}px`);
    };

    return (
        <Tabs
            ref={ref}
            value={currentIdx === -1 ? false : currentIdx}
            sx={(theme) => ({
                color: "inherit",
                overflow: "hidden",
                display: "flex",
                width: "100%",
                justifyContent: "center",
                [`& .${tabsClasses.indicator}`]: {
                    position: "absolute",
                    top: `calc(50% - 8px)`,
                    height: "16px",
                    filter: "blur(50px)",
                    backgroundColor: theme.palette.secondary.main,
                    zIndex: -1,
                },
                [`& .MuiTabs-scroller`]: {
                    width: "100%",
                    overflow: "visible",
                },
                // Spacing of tabs for different breakpoints
                [`& .MuiTabs-flexContainer`]: {
                    width: "100%",
                    gap: "12px",
                    justifyContent: "center",
                    [theme.breakpoints.up("sm")]: {
                        gap: "30px",
                    },
                },
                [`&:hover .mouse-trail`]: {
                    opacity: 1,
                },
            })}
            onMouseMove={handleMouseMove}
        >
            {navItems.map((item) => (
                <NavItem key={item.to} {...item} />
            ))}
            {/* Mouse hover effect */}
            <Box
                className="mouse-trail"
                sx={(theme) => ({
                    top: "var(--mouse-y)",
                    left: "var(--mouse-x)",
                    width: "10px",
                    height: "10px",
                    backgroundColor: theme.palette.secondary.main,
                    filter: "blur(25px)",
                    pointerEvents: "none",
                    transition: "opacity 0.3s ease-in-out",
                    transform: "translate(-50%, -50%)",
                    position: "absolute",
                    opacity: 0,
                    zIndex: -1,
                })}
            />
        </Tabs>
    );
}
