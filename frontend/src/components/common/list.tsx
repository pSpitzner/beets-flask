import { Link } from "@tanstack/react-router";

import { ListItemText, List as MuiList } from "@mui/material";
import ListItem, { ListItemProps } from "@mui/material/ListItem";

import { ReactNode, ComponentType } from "react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

interface WrapperProps<D = any> {
    children: ComponentType<ListChildComponentProps<Array<D>>>;
    className?: string;
    data: Array<D>;
}

function List<D> ({ children, data, ...props }: WrapperProps<D>){
    return <AutoSizer>
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
}

type ListItemData = {
    label: string;
    to?: string;
    icon?: ReactNode;
    [key: string]: any;
};

function Item({
    index,
    data,
    style,
}: ListChildComponentProps<ListItemData[]>) {

    const { label, to, icon, ...props } = data[index];

    const it = (
        <ListItem key={index} style={style} {...props}>
            {icon}
            <ListItemText primary={label} />
        </ListItem>
    );

    if (to) {
        return (
            <Link key={index} to={encodeURI(to)} preload={"intent"} preloadDelay={2000}>
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
