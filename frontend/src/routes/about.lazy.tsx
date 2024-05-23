import { Link, createLazyFileRoute } from "@tanstack/react-router";
import { Flex, Text, Button } from "@radix-ui/themes";

export const Route = createLazyFileRoute("/about")({
    component: About,
});

function About() {
    return (
        <Flex direction="column" className="p-2">
            <Text>Hello from About!</Text>
            <Link to="/">
                <Button variant="outline">Go to Home</Button>
            </Link>
        </Flex>
    );
}
