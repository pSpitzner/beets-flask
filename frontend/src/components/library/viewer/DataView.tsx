import { D } from "node_modules/@tanstack/react-query-devtools/build/modern/ReactQueryDevtools-Cn7cKi7o";
import { ComponentType } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import {
    FixedSizeList,
    FixedSizeListProps,
    ListChildComponentProps,
} from "react-window";

/**
 * Props for the children component of FixedGrid.
 * Extends ListChildComponentProps while omitting "data" and "index".
 * @template D - Type of the data items in the grid
 */
export type FixedGridChildrenProps<D> = Omit<
    ListChildComponentProps,
    "data" | "index"
> & {
    rowData: D[];
    startIndex: number;
    endIndex: number;
};

/**
 * Props for the FixedGrid component.
 * Extends FixedSizeListProps while customizing certain properties.
 * @template D - Type of the data items in the grid
 */
export interface FixedGridProps<D>
    extends Omit<
        FixedSizeListProps,
        "children" | "itemCount" | "height" | "width" | "itemSize"
    > {
    itemHeight: number;
    itemWidth: number;
    data: D[];
    itemCount?: number;
    children: ComponentType<FixedGridChildrenProps<D>>;
}

/**
 * A virtualized grid component that efficiently renders items in a fixed-size grid layout.
 * Uses react-window's FixedSizeList internally but converts it to a grid layout.
 * @template D - Type of the data items in the grid
 * @param {FixedGridProps<D>} props - Component props
 * @returns {JSX.Element} A virtualized grid component
 */
export function FixedGrid<D>({
    itemHeight,
    itemWidth,
    children: Comp,
    itemCount,
    data,
    onItemsRendered,
    ...props
}: FixedGridProps<D>) {
    const nItems = itemCount ?? data.length;

    return (
        <AutoSizer>
            {({ height, width }) => {
                // Split all album covers by row to fit width
                const nColumns = Math.floor(width / itemWidth);
                const nRows = Math.ceil(nItems / nColumns);

                return (
                    <FixedSizeList
                        itemSize={itemHeight}
                        height={height}
                        width={width}
                        itemCount={nRows}
                        onItemsRendered={({
                            visibleStartIndex,
                            visibleStopIndex,
                            overscanStartIndex,
                            overscanStopIndex,
                        }) => {
                            onItemsRendered?.({
                                visibleStartIndex: visibleStartIndex * nColumns,
                                visibleStopIndex: visibleStopIndex * nColumns,
                                overscanStartIndex: overscanStartIndex * nColumns,
                                overscanStopIndex: overscanStopIndex * nColumns,
                            });
                        }}
                        {...props}
                    >
                        {({ index, ...props }) => {
                            // Calculate the start and end index for the current row
                            const startIndex = index * nColumns;
                            const endIndex = Math.min(startIndex + nColumns, nItems);
                            const dataSlice = data.slice(startIndex, endIndex);
                            return (
                                <Comp
                                    key={index}
                                    rowData={dataSlice}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                    {...props}
                                />
                            );
                        }}
                    </FixedSizeList>
                );
            }}
        </AutoSizer>
    );
}

/**
 * Props for the children component of FixedList.
 * Uses the standard ListChildComponentProps from react-window.
 * Data might be none if the list is not populated or the index is out of bounds.
 * @template D - Type of the data items in the list
 */
export type FixedListChildrenProps<D> = Omit<ListChildComponentProps<D>, "data"> & {
    data?: D; // Single data item for the current index
};

/**
 * Props for the FixedList component.
 * Extends FixedSizeListProps while customizing certain properties.
 * @template D - Type of the data items in the list
 */
export interface FixedListProps<D>
    extends Omit<
        FixedSizeListProps,
        "children" | "itemCount" | "height" | "width" | "itemSize"
    > {
    itemHeight: number; // Height of each list item
    itemCount?: number; // Optional total item count (defaults to data.length)
    data: D[]; // Array of data items to display
    children: ComponentType<FixedListChildrenProps<D>>; // Component to render each item
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
                <FixedSizeList
                    itemSize={itemHeight}
                    height={height}
                    width={width}
                    itemCount={itemCount ?? data.length}
                    itemData={data}
                    {...props}
                >
                    {({ index, style }) => {
                        const itemData = data.at(index);
                        return (
                            <Comp
                                key={index}
                                index={index}
                                style={style}
                                data={itemData}
                            />
                        );
                    }}
                </FixedSizeList>
            )}
        </AutoSizer>
    );
}
