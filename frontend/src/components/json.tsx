export function JSONPretty(props: any) {
    return (
        <pre>
            <code>{JSON.stringify(props, undefined, 4)}</code>
        </pre>
    );
}
