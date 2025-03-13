import { ComponentType, ReactNode, useEffect, useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { Box } from "@mui/material";
import ListItem, { ListItemOwnProps } from "@mui/material/ListItem";
import { Link } from "@tanstack/react-router";

import styles from "./list.module.scss";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface WrapperProps<D = ListItemData> {
    children: ComponentType<ListChildComponentProps<D[]>>;
    className?: string;
    data: D[];
}

function List<D>({ children, data, ...props }: WrapperProps<D>) {
    return (
        <AutoSizer defaultHeight={50}>
            {({ height, width }) => (
                <FixedSizeList
                    className={styles.List}
                    height={height}
                    width={width}
                    itemData={data}
                    itemCount={data.length}
                    itemSize={35}
                    {...props}
                >
                    {children}
                </FixedSizeList>
            )}
        </AutoSizer>
    );
}

export interface ListItemData extends ListItemOwnProps {
    label: string | ReactNode;
    to?: string;
    params?: Record<string, unknown>;
    icon?: ReactNode;
    animateOverflow?: boolean;
}

function Item({ index, data, style }: ListChildComponentProps<ListItemData[]>) {
    const { label, to, params, icon, animateOverflow = true, ...props } = data[index];
    const labelRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const el = labelRef.current;
        if (el) {
            const parent = el.parentElement?.parentElement;
            const diff = parent ? parent.clientWidth - el.scrollWidth - 15 : 0;
            if (animateOverflow && parent && diff < 0) {
                setIsOverflowing(true);
                el.style.setProperty("--translate-distance", `${diff}px`);
            } else {
                setIsOverflowing(false);
                el.style.removeProperty("--translate-distance");
            }
        }
    }, [labelRef, label, animateOverflow]);

    const it = (
        <ListItem key={index} style={style} {...props}>
            {icon}
            <div>
                {
                    <Box
                        ref={labelRef}
                        className={`${styles.ListItemText} ${isOverflowing ? styles.overflowing : ""}`}
                    >
                        {label}
                    </Box>
                }
            </div>
        </ListItem>
    );

    if (to) {
        return (
            <Link
                key={index}
                to={to}
                params={params}
                preload={"intent"}
                preloadDelay={2000}
            >
                {it}
            </Link>
        );
    }
    return it;
}

List.Item = Item;

export default List;
