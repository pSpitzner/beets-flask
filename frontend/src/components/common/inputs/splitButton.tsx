import { ChevronDownIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    Button,
    ButtonGroup,
    ButtonGroupProps,
    ButtonProps,
    ClickAwayListener,
    Grow,
    MenuItem,
    MenuList,
    Paper,
    Popper,
} from "@mui/material";

interface Option {
    label: string; // Display text for the option
    key: string; // Unique identifier for the option, used for event handling
    buttonProps?: ButtonProps; // Optional props for the button, allowing customization like icons, styles, etc.
}

export interface SplitButtonOptionProps extends Omit<ButtonGroupProps, "onClick"> {
    options: Option[]; // Array of options for the dropdown
    onClick?: (
        option: Option,
        evt: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => void; // Callback when an option is selected
    onMenuItemClick?: (
        option: Option,
        index: number,
        evt: React.MouseEvent<HTMLLIElement, MouseEvent>
    ) => void; // Callback when a menu item is clicked
    btnProps?: ButtonProps; // Additional props for the main button
    defaultSelectedIndex?: number; // Optional default selected index
    loading?: boolean; // Optional loading state for the button
}

/**
 * A split button component that combines a primary action button with a dropdown menu of additional options.
 *
 * Features:
 * - Customizable button and dropdown options
 * - Keyboard and mouse accessibility
 * - Smooth dropdown animations
 * - Type-safe props and event handling
 */
export function SplitButtonOptions({
    options,
    onClick,
    onMenuItemClick,
    defaultSelectedIndex = 0,
    loading = false,
    ...props
}: SplitButtonOptionProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [minWidth, setMinWidth] = useState(0);
    const anchorRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(defaultSelectedIndex);

    // Memoize selected option to prevent unnecessary re-renders
    const selectedOption = useMemo(() => options[selectedIdx], [options, selectedIdx]);

    /**
     * Handle menu item selection
     */
    const handleMenuItemClick = useCallback(
        (event: React.MouseEvent<HTMLLIElement, MouseEvent>, index: number) => {
            setSelectedIdx(index);
            onMenuItemClick?.(options[index], index, event);
            setOpen(false);
        },
        [onMenuItemClick, options]
    );

    /**
     * Toggle dropdown visibility
     */
    const handleToggle = useCallback(() => {
        setOpen((prevOpen) => !prevOpen);
    }, []);

    /**
     * Close dropdown when clicking outside
     */
    const handleClose = useCallback((event: MouseEvent | TouchEvent) => {
        if (anchorRef.current?.contains(event.target as Node)) {
            return;
        }
        setOpen(false);
    }, []);

    /**
     * Handle main button click
     */
    const handleMainButtonClick = useCallback(
        (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            onClick?.(selectedOption, event);
            handleClose(event.nativeEvent);
        },
        [onClick, selectedOption, handleClose]
    );

    return (
        <>
            <ButtonGroup
                variant="contained"
                ref={anchorRef}
                aria-label="split button"
                {...props}
            >
                <Button
                    {...selectedOption.buttonProps}
                    onClick={handleMainButtonClick}
                    loading={loading}
                    sx={{
                        minWidth: `${minWidth}px !important`, // Ensure the button has a minimum width
                    }}
                >
                    <span>{selectedOption.label}</span>
                </Button>
                <Button
                    onClick={handleToggle}
                    size="small"
                    aria-label="select action"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-controls="split-button-menu"
                >
                    <ChevronDownIcon />
                </Button>
            </ButtonGroup>

            <Popper
                sx={(theme) => ({
                    zIndex: 1,
                    width: `calc(${anchorRef.current?.clientWidth}px - ${theme.spacing(1)})`, // Adjust width to fit within the button group
                    maxWidth: `calc(${anchorRef.current?.clientWidth}px - ${theme.spacing(1)})`, // Ensure max width matches the button group
                    overflow: "hidden",
                    boxShadow: 8,
                })}
                ref={ref}
                open={open}
                anchorEl={anchorRef.current}
                role={undefined}
                transition
            >
                {({ TransitionProps, placement }) => (
                    <Grow
                        {...TransitionProps}
                        style={{
                            transformOrigin:
                                placement === "bottom" ? "center top" : "center bottom",
                        }}
                    >
                        <Paper
                            sx={{
                                borderTopLeftRadius: 0,
                                borderTopRightRadius: 0,
                            }}
                        >
                            <ClickAwayListener onClickAway={handleClose}>
                                <MenuList id="split-button-menu" autoFocusItem>
                                    {options.map((option, index) => (
                                        <MenuItem
                                            key={option.key}
                                            selected={index === selectedIdx}
                                            onClick={(event) =>
                                                handleMenuItemClick(event, index)
                                            }
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                }}
                                            >
                                                {option.buttonProps?.startIcon}
                                            </span>
                                            <span
                                                style={{ flexGrow: 1 }}
                                                ref={(el) => {
                                                    setMinWidth((prev) =>
                                                        Math.max(
                                                            prev,
                                                            el?.offsetWidth || 0
                                                        )
                                                    );
                                                }}
                                            >
                                                {option.label}
                                            </span>
                                            <span style={{ flexShrink: 0 }}>
                                                {option.buttonProps?.endIcon}
                                            </span>
                                        </MenuItem>
                                    ))}
                                </MenuList>
                            </ClickAwayListener>
                        </Paper>
                    </Grow>
                )}
            </Popper>
        </>
    );
}
