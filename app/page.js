"use client";
import dynamic from "next/dynamic";

const YouTubePlaylistChatTool = dynamic(
    () => import("../components/YouTubePlaylistChatTool"),
    { ssr: false }
);

export default function Home() {
    return <YouTubePlaylistChatTool />;
}
