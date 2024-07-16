// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JSONPretty(props: any) {
    return (
        <pre>
            <code>{JSON.stringify(props, undefined, 4)}</code>
        </pre>
    );
}
