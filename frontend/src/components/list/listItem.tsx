import { Link } from "@tanstack/react-router";

import { ListItemText, List as MuiList } from '@mui/material';
import ListItem, { ListItemProps } from '@mui/material/ListItem';

import {ReactNode } from "react";
import Box from "@mui/material/Box";

import styles from "./list.module.scss";




function Wrapper({children}:{children: ReactNode}){
    return <Box className={styles.wrapper}>
        <MuiList>
            {children}
        </MuiList>
    </Box>
}


export interface ItemProps extends ListItemProps{
    label:string;
    icon?:React.ReactNode;
    to?:string;
}

function Item({label, to, icon,...props}:ItemProps){

    const it = <ListItem className={styles.item} {...props}>
        {icon}
        <ListItemText primary={label}/>
    </ListItem>

    if (to) {
        return <Link to={to}>
            {it}
        </Link>
    }
    return it;
}

const List = {
    Wrapper,
    Item,
};
export default List;


/**
 * import List from ...#efefef
 *
 * const data =
 *
 * return <List.Wrapper>
 * {data.map()=>{
 *  <List.Item to={data.}/>
 * }}
 *
 */
