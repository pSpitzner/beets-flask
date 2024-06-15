import { Link } from "@tanstack/react-router";

import { ListItemText, List as MuiList } from "@mui/material";
import ListItem, { ListItemProps } from "@mui/material/ListItem";

import { ReactNode } from "react";

interface WrapperProps {
    children: ReactNode;
    className?: string;
}

const Wrapper = ({ children, ...props }: WrapperProps) => (
    <MuiList {...props}>{children}</MuiList>
);

export interface ItemProps extends ListItemProps {
    label: string;
    icon?: React.ReactNode;
    to?: string;
}

const Item = ({ label, to, icon, ...props }: ItemProps) => {
    const it = (
        <ListItem {...props}>
            {icon}
            <ListItemText primary={label} />
        </ListItem>
    );

    if (to) {
        return <Link to={to}>{it}</Link>;
    }
    return it;
};

const List = ({ children }: WrapperProps) => <Wrapper>{children}</Wrapper>;
List.Item = Item;

export default List;
