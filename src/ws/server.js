import {WebSocket, WebSocketServer} from 'ws';

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    const id = Number(matchId);
    if(!matchSubscribers.has(id)) {
        matchSubscribers.set(id, new Set());
    }

    matchSubscribers.get(id).add(socket);
}

function unsubscribe(matchId, socket) {
    const id = Number(matchId);
    const subscribers = matchSubscribers.get(id);

    if(!subscribers) return;

    subscribers.delete(socket);

    if(subscribers.size === 0) {
        matchSubscribers.delete(id);
    }
}

function cleanupSubscriptions(socket) {
    for(const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

function sendJson(socket, payload) {
    if(socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
    for (const client of wss.clients)  {
        if(client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}

function broadcastToMatch(matchId, payload) {
    const id = Number(matchId);
    const subscribers = matchSubscribers.get(id);
    if(!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for(const client of subscribers) {
        if(client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
    }

    if(message?.type === "subscribe" && (Number.isInteger(message.matchId) || !isNaN(Number(message.matchId)))) {
        const id = Number(message.matchId);
        subscribe(id, socket);
        socket.subscriptions.add(id);
        sendJson(socket, { type: 'subscribed', matchId: id });
        return;
    }

    if(message?.type === "unsubscribe" && (Number.isInteger(message.matchId) || !isNaN(Number(message.matchId)))) {
        const id = Number(message.matchId);
        unsubscribe(id, socket);
        socket.subscriptions.delete(id);
        sendJson(socket, { type: 'unsubscribed', matchId: id });
    }
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: 1024 * 1024 });

    server.on('upgrade', async (req, socket, head) => {
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);

        if (pathname !== '/ws') {
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', async (socket, req) => {
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });

        socket.subscriptions = new Set();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => {
            cleanupSubscriptions(socket);
        })

        socket.on('error', console.error);
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();

            ws.isAlive = false;
            ws.ping();
        })}, 30000);

    wss.on('close', () => clearInterval(interval));

    function broadcastMatchCreated(match) {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }

    function broadcastCommentary(matchId, comment) {
        broadcastToMatch(matchId, { type: 'commentary', data: comment });
    }

    function broadcastScoreUpdate(matchId, score) {
        broadcastToAll(wss, { type: 'score_update', matchId, data: score });
    }

    return { broadcastMatchCreated, broadcastCommentary, broadcastScoreUpdate };
}