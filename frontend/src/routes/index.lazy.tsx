import { createLazyFileRoute } from "@tanstack/react-router";
import { Heading, Container, Section } from "@radix-ui/themes";

import { InboxOverview } from "../components/inbox";

export const Route = createLazyFileRoute("/")({
    component: Index,
});

/** The index is basically a overview
 * of the current inbox and database.
 *
 * It also gives links to other relevant
 * pages.
 */
function Index() {
    return (
        <Container className="p-2">
            <Heading>Music library</Heading>
            <Section>
                <InboxOverview />
            </Section>
        </Container>
    );
}
