import { Flex, Card, Text, Tooltip, Table, IconButton, Code } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { FolderClock, Inbox } from "lucide-react";
import { ButtonIconWithText } from "./common/button";

export function InboxOverview() {
    return (
        <Card style={{ width: "500px" }}>
            <CardHeader />
            <CardBody />
            <CardFooter />
        </Card>
    );
}

function CardHeader() {
    return (
        <Flex gap="2" align="center">
            <Inbox size="3rem" />
            <Flex direction="column" gap="1" className="mr-auto">
                <Text as="span" size="5" weight="bold">
                    Inbox
                </Text>
                <Code size="1">/my/mount/point</Code>
            </Flex>
            <Flex gap="4">
                <Flex direction="column">
                    <Text>Last scan</Text>
                    <Text color="gray">3 days ago</Text>
                </Flex>
                <Tooltip content="Schedule inbox scans">
                    <Link to="/schedule">
                        <IconButton
                            color="gray"
                            radius="full"
                            variant="ghost"
                            className="p-4"
                            aria-label="Schedule inbox scans"
                        >
                            <FolderClock size="1.2rem" />
                        </IconButton>
                    </Link>
                </Tooltip>
            </Flex>
        </Flex>
    );
}
function CardBody() {
    return (
        <>
            <Table.Root size="1" className="p-4 mb-2">
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeaderCell align="center">
                            <Tooltip content="Files that have not been tagged yet">
                                <span>New</span>
                            </Tooltip>
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell align="center">
                            <Tooltip content="Files already tagged and copied into the library">
                                <span>Tagged</span>
                            </Tooltip>
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell align="center">
                            Total
                        </Table.ColumnHeaderCell>
                    </Table.Row>
                </Table.Header>

                <Table.Body>
                    <Table.Row>
                        <Table.Cell align="center">
                            <Text color="gray">1000</Text>
                        </Table.Cell>
                        <Table.Cell align="center">
                            <Text color="gray">50</Text>
                        </Table.Cell>
                        <Table.Cell align="center">
                            <Text color="gray">1050</Text>
                        </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                        <Table.Cell align="center">
                            <Text color="gray">10 gb</Text>
                        </Table.Cell>
                        <Table.Cell align="center">
                            <Text color="gray">0.5 gb</Text>
                        </Table.Cell>
                        <Table.Cell align="center">
                            <Text color="gray">10.5 gb</Text>
                        </Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>
        </>
    );
}

function CardFooter() {
    return (
        <Flex gap="2" justify="between">
            <ButtonIconWithText icon="trash-2" text="Remove all files" color="red" />
            <Flex gap="5">
                <ButtonIconWithText
                    icon="recycle"
                    text="Clear tagged files"
                    color="yellow"
                />
                <ButtonIconWithText icon="file-scan" text="Scan for new files" />
            </Flex>
        </Flex>
    );
}
