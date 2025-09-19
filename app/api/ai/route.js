// app/api/ai/route.js
export async function POST(req) {
    try {
        const body = await req.json();
        const { systemPrompt, userMessage } = body || {};

        if (!systemPrompt && !userMessage) {
            return new Response(JSON.stringify({ error: 'Missing prompt' }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();

        if (AI_PROVIDER === 'gemini') {
            const API_KEY = process.env.GEMINI_API_KEY;
            if (!API_KEY) {
                return new Response(JSON.stringify({ error: 'Server missing GEMINI_API_KEY' }), { status: 500, headers: { "Content-Type": "application/json" } });
            }
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: (systemPrompt || '') + '\n\nUser question: ' + (userMessage || '') }]
                    }]
                })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error?.message || `Gemini error ${resp.status}`);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return new Response(JSON.stringify({ text }), { status: 200, headers: { "Content-Type": "application/json" } });
        } else {
            // default: openai
            const API_KEY = process.env.OPENAI_API_KEY;
            if (!API_KEY) {
                return new Response(JSON.stringify({ error: 'Server missing OPENAI_API_KEY' }), { status: 500, headers: { "Content-Type": "application/json" } });
            }

            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt || '' },
                        { role: 'user', content: userMessage || '' }
                    ],
                    max_tokens: 1000
                })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error?.message || `OpenAI error ${resp.status}`);
            const text = data.choices?.[0]?.message?.content || '';
            return new Response(JSON.stringify({ text }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
    } catch (err) {
        console.error('AI proxy error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
