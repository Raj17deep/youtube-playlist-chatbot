// components/YouTubePlaylistChatTool.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Search, MessageCircle, Send, Youtube, Clock, Eye, Calendar, Bot, User, RefreshCw, AlertCircle, Server, Globe } from 'lucide-react';

const YouTubePlaylistChatTool = () => {
    const [playlistUrl, setPlaylistUrl] = useState('');
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [playlistInfo, setPlaylistInfo] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('checking');
    const messagesEndRef = useRef(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

    useEffect(() => { checkBackendConnection(); }, []);

    const checkBackendConnection = async () => {
        setConnectionStatus('checking');
        try {
            const res = await fetch('/api/youtube-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ping' })
            });
            if (res.ok) {
                setConnectionStatus('connected-local');
                return;
            }
        } catch (e) {
            console.log('Local backend not available');
        }

        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            setConnectionStatus('connected-vercel');
            return;
        }

        setConnectionStatus('direct-cors-warning');
    };

    const extractPlaylistId = (url) => {
        const regex = /[&?]list=([^&]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    };

    const formatDuration = (duration) => {
        if (!duration) return 'N/A';
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return duration;
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatViewCount = (count) => {
        if (!count) return 'N/A';
        const num = parseInt(count);
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K views';
        return num + ' views';
    };

    const formatPublishDate = (date) => date ? new Date(date).toLocaleDateString() : 'N/A';

    const fetchPlaylistData = async () => {
        setError('');
        const playlistId = extractPlaylistId(playlistUrl);
        if (!playlistId) {
            setError('Invalid YouTube playlist URL. Please enter a valid playlist URL.');
            return;
        }

        setLoading(true);
        setVideos([]);
        setChatMessages([]);
        setPlaylistInfo(null);

        try {
            let allVideos = [];
            let nextPageToken = '';
            let playlistTitle = '';

            // get playlist info
            try {
                const resInfo = await fetch('/api/youtube-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getPlaylistInfo', playlistId })
                });
                const infoData = await resInfo.json();
                if (infoData.items && infoData.items.length > 0) {
                    playlistTitle = infoData.items[0].snippet.title;
                }
            } catch (e) {
                console.log('Could not fetch playlist title:', e);
                playlistTitle = `Playlist ${playlistId}`;
            }

            // pagination to collect playlist items
            do {
                const res = await fetch('/api/youtube-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getPlaylistItems', playlistId, pageToken: nextPageToken })
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.details?.error?.message || `YouTube API returned ${res.status}`);
                }

                const data = await res.json();
                allVideos = [...allVideos, ...(data.items || [])];
                nextPageToken = data.nextPageToken;
            } while (nextPageToken);

            if (allVideos.length === 0) throw new Error('No videos found in playlist. It might be private or empty.');

            // fetch video details in batches
            const batchSize = 50;
            let enrichedVideos = [];

            for (let i = 0; i < allVideos.length; i += batchSize) {
                const batch = allVideos.slice(i, i + batchSize);
                const videoIds = batch.map(item => item.snippet.resourceId.videoId).join(',');

                const resVideos = await fetch('/api/youtube-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getVideos', ids: videoIds })
                });

                const videosData = resVideos.ok ? await resVideos.json() : { items: [] };

                const batchEnriched = batch.map((playlistItem, batchIndex) => {
                    const videoId = playlistItem.snippet.resourceId.videoId;
                    const videoDetails = videosData.items?.find(v => v.id === videoId);
                    return {
                        position: i + batchIndex + 1,
                        videoId,
                        title: playlistItem.snippet.title,
                        description: playlistItem.snippet.description || '',
                        channelTitle: playlistItem.snippet.channelTitle,
                        publishedAt: playlistItem.snippet.publishedAt,
                        thumbnail: playlistItem.snippet.thumbnails?.medium?.url || playlistItem.snippet.thumbnails?.default?.url,
                        duration: videoDetails?.contentDetails?.duration || 'N/A',
                        viewCount: videoDetails?.statistics?.viewCount || 'N/A',
                        likeCount: videoDetails?.statistics?.likeCount || 'N/A',
                        commentCount: videoDetails?.statistics?.commentCount || 'N/A'
                    };
                });

                enrichedVideos = [...enrichedVideos, ...batchEnriched];
            }

            setVideos(enrichedVideos);
            setPlaylistInfo({ title: playlistTitle, videoCount: enrichedVideos.length });
            setChatMessages([{
                role: 'assistant',
                content: `Successfully loaded ${enrichedVideos.length} videos from "${playlistTitle}". You can now ask me questions about the playlist.`
            }]);

        } catch (err) {
            setError(err.message || 'Error fetching playlist');
        } finally {
            setLoading(false);
        }
    };

    const sendChatMessage = async () => {
        if (!currentMessage.trim()) return;

        const userMessage = currentMessage.trim();
        setCurrentMessage('');
        setChatLoading(true);

        const newMessages = [...chatMessages, { role: 'user', content: userMessage }];
        setChatMessages(newMessages);

        try {
            const playlistContext = videos.map(video =>
                `Position ${video.position}: "${video.title}" by ${video.channelTitle} (Duration: ${formatDuration(video.duration)}, Views: ${formatViewCount(video.viewCount)}, Published: ${formatPublishDate(video.publishedAt)})`
            ).join('\n');

            const systemPrompt = `You are an AI assistant analyzing a YouTube playlist${playlistInfo ? ` titled "${playlistInfo.title}"` : ''}. Here are all ${videos.length} videos in the playlist:

${playlistContext}

Please answer the user's questions about this playlist. You can analyze patterns, find specific content, calculate statistics, and provide insights about the video collection.`;

            const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt, userMessage })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'AI backend error');
            }

            const data = await res.json();
            const aiResponse = data.text || 'Sorry, I could not generate a response.';
            setChatMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
        } catch (err) {
            setChatMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    };

    const getConnectionStatusDisplay = () => {
        switch (connectionStatus) {
            case 'checking': return { icon: RefreshCw, text: 'Checking backend...', color: 'text-yellow-600 animate-spin' };
            case 'connected-local': return { icon: Server, text: 'Local backend connected', color: 'text-green-600' };
            case 'connected-vercel': return { icon: Globe, text: 'Serverless backend ready', color: 'text-blue-600' };
            case 'direct-cors-warning': return { icon: AlertCircle, text: 'Direct mode (CORS issues expected)', color: 'text-red-600' };
            default: return { icon: AlertCircle, text: 'Unknown status', color: 'text-gray-600' };
        }
    };

    const statusDisplay = getConnectionStatusDisplay();
    const StatusIcon = statusDisplay.icon;

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-red-600 text-white p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Youtube className="w-8 h-8" />
                                <div>
                                    <h1 className="text-2xl font-bold">YouTube Playlist Chat Tool</h1>
                                    <div className="flex items-center space-x-4">
                                        {playlistInfo && <p className="text-red-100 text-sm">{playlistInfo.title} • {playlistInfo.videoCount} videos</p>}
                                        <div className="flex items-center space-x-1">
                                            <StatusIcon className={`w-4 h-4 ${statusDisplay.color}`} />
                                            <span className="text-red-100 text-xs">{statusDisplay.text}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* no settings button */}
                        </div>
                    </div>

                    {/* Input Section */}
                    <div className="p-6 border-b">
                        <div className="flex space-x-3">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={playlistUrl}
                                    onChange={(e) => setPlaylistUrl(e.target.value)}
                                    placeholder="Enter YouTube playlist URL (e.g., https://www.youtube.com/playlist?list=...)"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <button
                                onClick={fetchPlaylistData}
                                disabled={loading}
                                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                            >
                                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                <span>{loading ? 'Loading...' : 'Analyze'}</span>
                            </button>
                        </div>
                        {error && <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded whitespace-pre-line">{error}</div>}
                    </div>

                    {/* Main Content */}
                    <div className="flex">
                        {/* Videos List */}
                        <div className="w-1/2 p-6 border-r">
                            <h2 className="text-xl font-semibold mb-4 flex items-center">
                                <Youtube className="w-5 h-5 mr-2" /> Videos ({videos.length})
                            </h2>
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {videos.map(video => (
                                    <div key={video.videoId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex space-x-3">
                                            <img src={video.thumbnail} alt={video.title} className="w-24 h-18 object-cover rounded flex-shrink-0"
                                                onError={(e) => { e.target.src = `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`; }} />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-sm line-clamp-2 mb-1">{video.title}</h3>
                                                <p className="text-xs text-gray-600 mb-2">{video.channelTitle}</p>
                                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                    <div className="flex items-center"><Clock className="w-3 h-3 mr-1" />{formatDuration(video.duration)}</div>
                                                    <div className="flex items-center"><Eye className="w-3 h-3 mr-1" />{formatViewCount(video.viewCount)}</div>
                                                    <div className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{formatPublishDate(video.publishedAt)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chat Section */}
                        <div className="w-1/2 flex flex-col">
                            <div className="p-4 border-b">
                                <h2 className="text-xl font-semibold flex items-center">
                                    <MessageCircle className="w-5 h-5 mr-2" /> Chat about Playlist
                                </h2>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto max-h-96">
                                <div className="space-y-4">
                                    {chatMessages.map((message, index) => (
                                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === 'user' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                                <div className="flex items-start space-x-2">
                                                    {message.role === 'assistant' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                    {message.role === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                                                <div className="flex items-center space-x-2">
                                                    <Bot className="w-4 h-4" />
                                                    <div className="flex space-x-1">
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Input */}
                            <div className="p-4 border-t">
                                <div className="flex space-x-3">
                                    <input
                                        type="text"
                                        value={currentMessage}
                                        onChange={(e) => setCurrentMessage(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Ask about the playlist..."
                                        disabled={videos.length === 0 || chatLoading}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                                    />
                                    <button
                                        onClick={sendChatMessage}
                                        disabled={videos.length === 0 || chatLoading || !currentMessage.trim()}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default YouTubePlaylistChatTool;
