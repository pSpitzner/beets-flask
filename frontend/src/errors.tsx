import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

import brokenRecord from "@/assets/broken-record.png";
import CardActions from "@mui/material/CardActions";
import AccordionSummary from "@mui/material/AccordionSummary";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";

/** Default component for showing errors
 * Hopefully this should not happen, but they
 * are also useful for debugging.
 *
 * This basically shows a card with the error message
 * and the stack trace.
 *
 * Also includes a link to the github issues page.
 */
export function ErrorCard({ error }: { error: Error }) {
    return (
        <Card
            sx={(theme) => ({
                maxWidth: theme.breakpoints.values.sm,
                margin: "auto",
                padding: "0.25rem",
                gap: "0.5rem",
                display: "flex",
                flexDirection: "column",
            })}
        >
            <Box sx={{ display: "flex", gap: "1rem" }}>
                <CardContent>
                    <Typography
                        gutterBottom
                        sx={{ color: "text.secondary", fontSize: 14 }}
                    >
                        {error.name}
                    </Typography>
                    <Typography
                        variant="h5"
                        component="div"
                        sx={{ fontWeight: "bold", fontSize: 20 }}
                    >
                        Oh no! Seems like we dropped a beat!
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", marginTop: "0.2rem" }}
                    >
                        If this is a reoccurring issue, feel free to raise an{" "}
                        <Link href="https://github.com/pSpitzner/beets-flask/issues">
                            issue on GitHub
                        </Link>
                        .
                    </Typography>
                </CardContent>
                <CardMedia
                    component="img"
                    image={brokenRecord}
                    sx={{ maxWidth: "150px", height: "auto", objectFit: "contain" }}
                    title="broken record"
                />
            </Box>
            <CardActions>
                <div style={{ width: "100%" }}>
                    <Accordion
                        disableGutters
                        sx={(theme) => ({
                            width: "100%",
                            padding: 0,
                            backgroundColor: "transparent",
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <AccordionSummary>
                            <Typography component="span">Error Message</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ display: "flex", fontSize: 12 }}>
                            <pre>{error?.message}</pre>
                        </AccordionDetails>
                    </Accordion>
                    <Accordion
                        disableGutters
                        sx={(theme) => ({
                            width: "100%",
                            padding: 0,
                            margin: 0,
                            backgroundColor: "transparent",
                            border: `1px solid ${theme.palette.divider}`,
                            borderTop: "none",
                        })}
                    >
                        <AccordionSummary>
                            <Typography component="span">Stack Trace</Typography>
                        </AccordionSummary>
                        <AccordionDetails
                            sx={{ display: "flex", fontSize: 12, overflow: "auto" }}
                        >
                            <pre>{error?.stack}</pre>
                        </AccordionDetails>
                    </Accordion>
                </div>
            </CardActions>
        </Card>
    );
}
