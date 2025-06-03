# Table components to create a table with multiple views

We often need to display data in a tabular format, and this component provides a flexible way to do so:
- list & grid views
- infinite query support
- dynamic columns
- only fixed heights and widths!


## Example Usage


```tsx
// Define functions for viewing a row
function ListRow({data, style}) {
  return <div style={style}>{row}</div>;
}

function GridRow({rowData, style}) {
    return <div className="grid-row">
        {rowData.map((cell, index) => (
            <div key={index} className="grid-cell">{cell}</div>
        ))}
    </div>;
}

// Define table component
export MyTable({data}: {data: string[]}) {
    const [view, setView] = useState<'list' | 'grid'>('list');

    if (view === 'list') {
        return (
            <div>
                <FixedList data={data} itemHeight={50}>
                    {ListRow}
                </FixedList>
            </div>
        );
    }

    return (
        <div>
            <div className="grid-view">
                {data.map((row, index) => (
                    <GridRow key={index} rowData={row.split(',')} />
                ))}
            </div>
        </div>
    );
}

```



