import { ComponentType } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { List, type ListProps, type RowComponentProps } from "react-window";

/**
 * Props for the children component of FixedList.
 * Uses the standard ListChildComponentProps from react-window.
 * Data might be none if the list is not populated or the index is out of bounds.
 * @template D - Type of the data items in the list
 */
export type FixedListChildrenProps<D> = Omit<RowComponentProps<D>, "data"> & {
    data?: D; // Single data item for the current index
};

/**
 * Props for the FixedList component.
 * Extends FixedSizeListProps while customizing certain properties.
 * @template D - Type of the data items in the list
 */
export interface FixedListProps<D>
    extends Omit<
        ListProps<D>,
        "children" | "itemCount" | "height" | "width" | "itemSize"
    > {
    itemHeight: number; // Height of each list item
    itemCount?: number; // Optional total item count (defaults to data.length)
    data: D[]; // Array of data items to display
    children: ComponentType<RowComponentProps<D>>; // Component to render each item
}

/**
 * A virtualized list component that efficiently renders items in a fixed-height list.
 * Uses react-window's FixedSizeList internally with AutoSizer for responsive sizing.
 * @template D - Type of the data items in the list
 * @param {Omit<FixedListProps<D>, "itemWidth">} props - Component props
 * @returns {JSX.Element} A virtualized list component
 */
export function FixedList<D>({
    itemHeight,
    children: Comp,
    itemCount,
    data,
    ...props
}: FixedListProps<D>) {
    return (
        <AutoSizer>
            {({ height, width }) => (
                <List
                    itemSize={itemHeight}
                    itemCount={itemCount ?? data.length}
                    itemData={data}
                    rowComponent={Comp}
                    {...props}
                />
            )}
        </AutoSizer>
    );
}
