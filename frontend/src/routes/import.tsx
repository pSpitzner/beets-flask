import { createContext, useContext, useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    Typography,
} from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

// in beets language, items are tracks in the database.
// the info types are _very_ similar to what we get from our library queries
// just that we have added a custom `name` field to albums and items.
// annoying: albuminfo of candidates has a .artist, but albums from library dont.
import { Album as AlbumInfo, Item as TrackInfo } from "@/components/common/_query";
import { useImportSocket } from "@/components/common/useSocket";
import Ansi from "@curvenote/ansi-to-react";
import { JSONPretty } from "@/components/common/json";
import { SimilarityBadge } from "@/components/tags/similarityBadge";

export const Route = createFileRoute("/import")({
    component: ImportPage,
});

function ImportPage() {
    return (
        <ImportContextProvider>
            <ImportView />
        </ImportContextProvider>
    );
}

function ImportView() {
    const { socket, isConnected } = useImportContext();

    useEffect(() => {
        console.log(socket);
        console.log(isConnected);
    }, [socket, isConnected]);

    return (
        <>
            <StatusTextView />
            <PromptView />
            <CandidateSelectionView />
            <Typography>Is Connected: {isConnected ? "yes" : "no"}</Typography>
            <Button>Button</Button>
        </>
    );
}

function StatusTextView() {
    const { statusText } = useImportContext();

    return (
        <Box
            sx={{
                width: "300px",
                height: "300px",
                background: "#444",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                overflow: "auto",
                marginBottom: "1rem",
            }}
        >
            <Ansi useClasses>{statusText}</Ansi>
        </Box>
    );
}

function PromptView() {
    const { promptChoices, socket } = useImportContext();

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "row",
                gap: "0.5rem",
                marginBottom: "1rem",
            }}
        >
            {promptChoices.map((choice) => {
                return (
                    <Button
                        key={choice.short}
                        variant="outlined"
                        onClick={() => {
                            socket?.emit("choice", { prompt_choice: choice.short });
                        }}
                    >
                        {/* <Typography>{choice.short}</Typography> */}
                        {choice.long}
                    </Button>
                );
            })}
        </Box>
    );
}

function CandidateSelectionView() {
    const { candidateChoices, socket } = useImportContext();
    const [selection, setSelection] = useState(0);

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        setSelection(parseInt(event.target.value));
        const choice = candidateChoices[parseInt(event.target.value)];
        socket?.emit("choice", { candidate_choice: choice.id });
    }

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginBottom: "1rem",
                }}
            >
                <FormControl>
                    <RadioGroup
                        aria-labelledby="demo-controlled-radio-buttons-group"
                        name="controlled-radio-buttons-group"
                        value={selection}
                        onChange={handleChange}
                    >
                        {candidateChoices.map((choice) => {
                            return (
                                <FormControlLabel
                                    value={choice.id}
                                    key={choice.id}
                                    control={<Radio />}
                                    label={<CandidateView candidate={choice} />}
                                />
                            );
                        })}
                    </RadioGroup>
                </FormControl>
            </Box>
        </>
    );
}

function CandidateView({ candidate }: { candidate: CandidateChoice }) {
    return (
        <Box
            sx={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
            }}
            key={candidate.id}
        >
            <SimilarityBadge dist={candidate.match.distance} />
            <Typography>
                {candidate.match.info.artist} - {candidate.match.info.name}
            </Typography>
        </Box>
    );
}

/* ---------------------------------------------------------------------------------- */
/*                                       Socket                                       */
/* ---------------------------------------------------------------------------------- */

interface AlbumMatch {
    distance: number; // TODO: backend uses an object
    info: AlbumInfo;
    extra_tracks: TrackInfo[];
    extra_items: TrackInfo[];
    // mapping?: // not passed to frontend yet
}

interface TrackMatch {
    distance: number; // TODO: backend uses an object
    info: TrackInfo;
}

interface CandidateChoice {
    id: number;
    match: AlbumMatch | TrackMatch;
    type: "album" | "track";
}

interface PromptChoice {
    short: string;
    long: string;
    callback: string;
}

interface ConfirmableMessage {
    event: string;
    id: string;
    data: unknown;
}

interface ImportContextI {
    isConnected: boolean;
    receivedMessages: ConfirmableMessage[];
    promptChoices: PromptChoice[];
    candidateChoices: CandidateChoice[];
    statusText: string;
    socket?: Socket;
}

const ImportContext = createContext<ImportContextI>({
    isConnected: false,
    receivedMessages: [],
    promptChoices: [],
    candidateChoices: [],
    statusText: "",
});

const ImportContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { socket, isConnected } = useImportSocket();
    const [receivedMessages, setReceivedMessages] = useState<ConfirmableMessage[]>([]);
    const [promptChoices, setPromptChoices] = useState<PromptChoice[]>([]);
    const [candidateChoices, setCandidateChoices] = useState<CandidateChoice[]>([]);
    const [statusText, setStatusText] = useState<string>("");

    useEffect(() => {
        function confirmReceive(msg: ConfirmableMessage): void {
            socket.emit("receipt", { id: msg.id });
            setReceivedMessages((prev) => {
                if (!prev.some((m) => m.id === msg.id)) {
                    return [...prev, msg];
                }
                return prev;
            });
        }

        function handleText(msg: ConfirmableMessage) {
            confirmReceive(msg);
            setStatusText((prev) => prev + "\n" + (msg.data as string));
            console.log("Importer text update", msg);
        }

        function handleCandidates(msg: ConfirmableMessage) {
            confirmReceive(msg);
            setCandidateChoices(msg.data as CandidateChoice[]);
            console.log("Importer candidates", msg);
            console.log(msg.data);
        }

        function handlePrompt(msg: ConfirmableMessage) {
            confirmReceive(msg);
            setPromptChoices(msg.data as PromptChoice[]);
            console.log("Importer prompt", msg);
        }

        socket.on("text", handleText);
        socket.on("candidates", handleCandidates);
        socket.on("prompt", handlePrompt);

        return () => {
            socket.off("text", handleText);
            socket.off("candidates", handleCandidates);
            socket.off("prompt", handlePrompt);
        };
    }, [socket]);

    const socketState: ImportContextI = {
        isConnected,
        receivedMessages,
        promptChoices,
        candidateChoices,
        statusText,
        socket,
    };

    return (
        <ImportContext.Provider value={socketState}>{children}</ImportContext.Provider>
    );
};

const useImportContext = () => {
    const context = useContext(ImportContext);
    if (!context) {
        throw new Error(
            "useImportContext must be used within a ImportSocketContextProvider"
        );
    }
    return context;
};
