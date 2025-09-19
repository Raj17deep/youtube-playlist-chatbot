// app/api/youtube-proxy/route.js
export async function POST(req) {
    try {
        const body = await req.json();
        const { action } = body || {};

        // simple ping for connection checks
        if (action === 'ping') {
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const YT_KEY = process.env.YOUTUBE_API_KEY;
        if (!YT_KEY) {
            return new Response(JSON.stringify({ error: 'Server missing YOUTUBE_API_KEY' }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        let url = null;

        if (action === 'getPlaylistInfo') {
            const { playlistId } = body;
            url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${YT_KEY}`;
        } else if (action === 'getPlaylistItems') {
            const { playlistId, pageToken } = body;
            url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${YT_KEY}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        } else if (action === 'getVideos') {
            const { ids } = body; // comma separated
            url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${encodeURIComponent(ids)}&key=${YT_KEY}`;
        } else {
            return new Response(JSON.stringify({ error: 'Unknown action' }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const data = await upstream.json();

        if (!upstream.ok) {
            return new Response(JSON.stringify({ error: 'Upstream error', details: data }), {
                status: upstream.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error('youtube-proxy error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
