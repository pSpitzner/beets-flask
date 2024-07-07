import { Link } from "@tanstack/react-router";

import { ListItemText } from "@mui/material";
import ListItem, { ListItemOwnProps, ListItemProps } from "@mui/material/ListItem";

import { ReactNode, ComponentType } from "react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface WrapperProps<D = any> {
    children: ComponentType<ListChildComponentProps<D[]>>;
    className?: string;
    data: D[];
}

function List<D>({ children, data, ...props }: WrapperProps<D>) {
    return (
        <AutoSizer>
            {({ height, width }) => (
                <FixedSizeList
                    className="List"
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

interface ListItemData extends ListItemOwnProps {
    label: string;
    to?: string;
    params?: Record<string, unknown>;
    icon?: ReactNode;
}

function Item({ index, data, style }: ListChildComponentProps<ListItemData[]>) {
    const { label, to, params, icon, ...props } = data[index];

    const it = (
        <ListItem key={index} style={style} {...props}>
            {icon}
            <ListItemText primary={label} />
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

export interface ItemProps extends ListItemProps {
    label: string;
    icon?: React.ReactNode;
    to?: string;
}

List.Item = Item;

export default List;
