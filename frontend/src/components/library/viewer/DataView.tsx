import { ComponentType } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import {
    FixedSizeList,
    FixedSizeListProps,
    ListChildComponentProps,
} from "react-window";

export type FixedGridChildrenProps<D> = Omit<
    ListChildComponentProps,
    "data" | "index"
> & {
    rowData: D[];
    startIndex: number;
    endIndex: number;
};

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
