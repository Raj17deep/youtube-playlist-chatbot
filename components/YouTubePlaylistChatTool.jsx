import React, { useState, useRef, useEffect } from 'react';
import { Search, MessageCircle, Send, Youtube, Clock, Eye, Calendar, Bot, User, Key, Settings, RefreshCw, AlertCircle, ExternalLink, Server, Globe } from 'lucide-react';

const YouTubePlaylistChatTool = () => {
    const [playlistUrl, setPlaylistUrl] = useState('');
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [youtubeApiKey, setYoutubeApiKey] = useState('');
    const [aiProvider, setAiProvider] = useState('gemini');
    const [showSettings, setShowSettings] = useState(false);
    const [playlistInfo, setPlaylistInfo] = useState(null);
    const [backendMode, setBackendMode] = useState('auto'); // auto, local, vercel, direct
    const [connectionStatus, setConnectionStatus] = useState('checking');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    useEffect(() => {
        checkBackendConnection();
    }, []);

    const checkBackendConnection = async () => {
        setConnectionStatus('checking');

        try {
            // Try local development server first
            const localTest = await fetch('/api/youtube-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://httpbin.org/json' })
            });

            if (localTest.ok) {
                setBackendMode('local');
                setConnectionStatus('connected-local');
                return;
            }
        } catch (e) {
            console.log('Local backend not available');
        }

        // Check if we're on a deployed environment (like Vercel)
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            setBackendMode('vercel');
            setConnectionStatus('connected-vercel');
            return;
        }

        // Fallback to direct mode (will show CORS warning)
        setBackendMode('direct');
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

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    };

    const formatViewCount = (count) => {
        if (!count) return 'N/A';
        const num = parseInt(count);
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M views';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K views';
        }
        return num + ' views';
    };

    const formatPublishDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString();
    };

    const makeApiCall = async (url) => {
        if (backendMode === 'local' || backendMode === 'vercel') {
            // Use backend proxy
            const response = await fetch('/api/youtube-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }

            return await response.json();
        } else {
            // Direct API call (will likely fail due to CORS)
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`YouTube API error: ${response.status}`);
            }

            return await response.json();
        }
    };

    const fetchPlaylistData = async () => {
        if (!youtubeApiKey.trim()) {
            setError('Please enter your YouTube Data API key in settings');
            return;
        }

        const playlistId = extractPlaylistId(playlistUrl);
        if (!playlistId) {
            setError('Invalid YouTube playlist URL. Please enter a valid playlist URL.');
            return;
        }

        setLoading(true);
        setError('');
        setVideos([]);
        setChatMessages([]);
        setPlaylistInfo(null);

        try {
            let allVideos = [];
            let nextPageToken = '';
            let playlistTitle = '';

            // Get playlist info
            try {
                const playlistInfoUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${youtubeApiKey}`;
                const playlistData = await makeApiCall(playlistInfoUrl);

                if (playlistData.items && playlistData.items.length > 0) {
                    playlistTitle = playlistData.items[0].snippet.title;
                }
            } catch (e) {
                console.log('Could not fetch playlist title:', e);
                playlistTitle = `Playlist ${playlistId}`;
            }

            // Get playlist items with pagination
            do {
                const playlistItemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${youtubeApiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;

                const playlistData = await makeApiCall(playlistItemsUrl);

                if (playlistData.error) {
                    throw new Error(`YouTube API Error: ${playlistData.error.message}`);
                }

                allVideos = [...allVideos, ...playlistData.items];
                nextPageToken = playlistData.nextPageToken;
            } while (nextPageToken);

            if (allVideos.length === 0) {
                throw new Error('No videos found in playlist. The playlist might be empty, private, or the ID might be incorrect.');
            }

            // Get video details in batches
            const batchSize = 50;
            let enrichedVideos = [];

            for (let i = 0; i < allVideos.length; i += batchSize) {
                const batch = allVideos.slice(i, i + batchSize);
                const videoIds = batch.map(item => item.snippet.resourceId.videoId).join(',');

                try {
                    const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${youtubeApiKey}`;
                    const videosData = await makeApiCall(videoDetailsUrl);

                    const batchEnriched = batch.map((playlistItem, batchIndex) => {
                        const videoDetails = videosData.items?.find(v => v.id === playlistItem.snippet.resourceId.videoId);
                        return {
                            position: i + batchIndex + 1,
                            videoId: playlistItem.snippet.resourceId.videoId,
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
                } catch (batchError) {
                    console.warn(`Failed to fetch details for batch ${i + 1}:`, batchError);

                    // Fallback without detailed stats
                    const batchEnriched = batch.map((playlistItem, batchIndex) => ({
                        position: i + batchIndex + 1,
                        videoId: playlistItem.snippet.resourceId.videoId,
                        title: playlistItem.snippet.title,
                        description: playlistItem.snippet.description || '',
                        channelTitle: playlistItem.snippet.channelTitle,
                        publishedAt: playlistItem.snippet.publishedAt,
                        thumbnail: playlistItem.snippet.thumbnails?.medium?.url || playlistItem.snippet.thumbnails?.default?.url,
                        duration: 'N/A',
                        viewCount: 'N/A',
                        likeCount: 'N/A',
                        commentCount: 'N/A'
                    }));
                    enrichedVideos = [...enrichedVideos, ...batchEnriched];
                }
            }

            setVideos(enrichedVideos);
            setPlaylistInfo({
                title: playlistTitle,
                videoCount: enrichedVideos.length
            });

            setChatMessages([{
                role: 'assistant',
                content: `Successfully loaded ${enrichedVideos.length} videos from "${playlistTitle}". I have access to video titles, channels, publish dates, view counts, and durations. You can now ask me questions about the playlist content!

Try asking:
• "What are the most popular videos?"
• "Which channels are featured?"
• "Find videos about [specific topic]"
• "What's the total watch time?"
• "Show me recent videos"`
            }]);

        } catch (err) {
            let errorMessage = `Error fetching playlist: ${err.message}`;

            if (err.message.includes('403') || err.message.includes('quotaExceeded')) {
                errorMessage += '\n\n💡 YouTube API quota exceeded. Try again tomorrow or use a different API key.';
            } else if (err.message.includes('404')) {
                errorMessage += '\n\n💡 Playlist not found. Make sure the URL is correct and the playlist is public.';
            } else if (err.message.includes('CORS') || err.message.includes('Failed to fetch') || backendMode === 'direct') {
                errorMessage = `CORS Error: Cannot access YouTube API directly from browser.

🚀 SOLUTIONS:
${backendMode === 'direct' ? `
1. Set up local backend (recommended):
   • Copy the backend code from the documentation
   • Run with Next.js, Express.js, or Flask
   
2. Deploy to Vercel/Netlify:
   • Use the provided serverless function code
   
3. Browser extension (quick fix):
   • Install "CORS Unblock" extension
   • Enable temporarily while using this tool
   
4. Use the backend setup guide provided below.` : ''}`;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const sendChatMessage = async () => {
        if (!currentMessage.trim() || !apiKey.trim()) {
            if (!apiKey.trim()) {
                setError('Please enter your AI API key in settings');
            }
            return;
        }

        const userMessage = currentMessage.trim();
        setCurrentMessage('');
        setChatLoading(true);

        const newMessages = [...chatMessages, { role: 'user', content: userMessage }];
        setChatMessages(newMessages);

        try {
            let response;

            const playlistContext = videos.map(video =>
                `Position ${video.position}: "${video.title}" by ${video.channelTitle} (Duration: ${formatDuration(video.duration)}, Views: ${formatViewCount(video.viewCount)}, Published: ${formatPublishDate(video.publishedAt)})`
            ).join('\n');

            const systemPrompt = `You are an AI assistant analyzing a YouTube playlist${playlistInfo ? ` titled "${playlistInfo.title}"` : ''}. Here are all ${videos.length} videos in the playlist:

${playlistContext}

Please answer the user's questions about this playlist. You can analyze patterns, find specific content, calculate statistics, and provide insights about the video collection.`;

            if (aiProvider === 'gemini') {
                response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: systemPrompt + '\n\nUser question: ' + userMessage
                            }]
                        }]
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error?.message || 'Gemini API error');
                }

                const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
                setChatMessages([...newMessages, { role: 'assistant', content: aiResponse }]);

            } else if (aiProvider === 'openai') {
                response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ],
                        max_tokens: 1000
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error?.message || 'OpenAI API error');
                }

                const aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
                setChatMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
            }

        } catch (err) {
            setChatMessages([...newMessages, {
                role: 'assistant',
                content: `Error: ${err.message}. Please check your API key and try again.`
            }]);
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
            case 'checking':
                return { icon: RefreshCw, text: 'Checking backend...', color: 'text-yellow-600 animate-spin' };
            case 'connected-local':
                return { icon: Server, text: 'Local backend connected', color: 'text-green-600' };
            case 'connected-vercel':
                return { icon: Globe, text: 'Serverless backend ready', color: 'text-blue-600' };
            case 'direct-cors-warning':
                return { icon: AlertCircle, text: 'Direct mode (CORS issues expected)', color: 'text-red-600' };
            default:
                return { icon: AlertCircle, text: 'Unknown status', color: 'text-gray-600' };
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
                                        {playlistInfo && (
                                            <p className="text-red-100 text-sm">{playlistInfo.title} • {playlistInfo.videoCount} videos</p>
                                        )}
                                        <div className="flex items-center space-x-1">
                                            <StatusIcon className={`w-4 h-4 ${statusDisplay.color}`} />
                                            <span className="text-red-100 text-xs">{statusDisplay.text}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-2 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="bg-gray-100 p-4 border-b">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Key className="w-4 h-4 inline mr-1" />
                                        YouTube Data API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={youtubeApiKey}
                                        onChange={(e) => setYoutubeApiKey(e.target.value)}
                                        placeholder="Enter YouTube Data API key"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                    <a
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center mt-1"
                                    >
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        Get API Key
                                    </a>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        AI Provider
                                    </label>
                                    <select
                                        value={aiProvider}
                                        onChange={(e) => setAiProvider(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai">OpenAI GPT</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Key className="w-4 h-4 inline mr-1" />
                                        {aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={`Enter ${aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API key`}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            </div>

                            {connectionStatus === 'direct-cors-warning' && (
                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                                    <div className="flex items-start space-x-2">
                                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-800">
                                            <p className="font-medium">Backend Setup Required</p>
                                            <p className="mt-1">No backend detected. To fetch real playlist data, you need to set up a backend proxy to bypass CORS restrictions. Check the documentation below for complete setup instructions.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
                        {error && (
                            <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded whitespace-pre-line">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="flex">
                        {/* Videos List */}
                        <div className="w-1/2 p-6 border-r">
                            <h2 className="text-xl font-semibold mb-4 flex items-center">
                                <Youtube className="w-5 h-5 mr-2" />
                                Videos ({videos.length})
                            </h2>
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {videos.map((video) => (
                                    <div key={video.videoId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex space-x-3">
                                            <img
                                                src={video.thumbnail}
                                                alt={video.title}
                                                className="w-24 h-18 object-cover rounded flex-shrink-0"
                                                onError={(e) => {
                                                    e.target.src = `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-sm line-clamp-2 mb-1">{video.title}</h3>
                                                <p className="text-xs text-gray-600 mb-2">{video.channelTitle}</p>
                                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                    <div className="flex items-center">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {formatDuration(video.duration)}
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Eye className="w-3 h-3 mr-1" />
                                                        {formatViewCount(video.viewCount)}
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Calendar className="w-3 h-3 mr-1" />
                                                        {formatPublishDate(video.publishedAt)}
                                                    </div>
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
                                    <MessageCircle className="w-5 h-5 mr-2" />
                                    Chat about Playlist
                                </h2>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto max-h-96">
                                <div className="space-y-4">
                                    {chatMessages.map((message, index) => (
                                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === 'user'
                                                ? 'bg-red-600 text-white'
                                                : 'bg-gray-200 text-gray-800'
                                                }`}>
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