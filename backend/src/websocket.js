import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import url from 'url';
import User from './models/User.js';

// Map of userId -> Set of active WebSocket connections
const userSockets = new Map();
// Map of lowercase walletAddress -> Set of active WebSocket connections
const walletSockets = new Map();

let wssInstance = null;

export function initWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wssInstance = wss;

  wss.on('connection', async (ws, req) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      const token = parsedUrl.query.token;

      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'world-id-secret-key-2024');
      const userId = decoded.userId;

      const user = await User.findById(userId).select('username walletAddress nullifierHash').lean();
      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }

      ws.userId = userId;
      ws.user = user;
      ws.isAlive = true;

      // Track by userId
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(ws);

      // Track by walletAddress
      if (user.walletAddress) {
        const wallet = user.walletAddress.toLowerCase();
        if (!walletSockets.has(wallet)) {
          walletSockets.set(wallet, new Set());
        }
        walletSockets.get(wallet).add(ws);
      }

      console.log(`[WebSocket] Connected: ${user.username || userId} (${user.walletAddress || 'no-wallet'})`);

      // Welcome handshake with server timestamp
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        userId,
        walletAddress: user.walletAddress,
        timestamp: new Date().toISOString(),
      }));

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch {
          // Ignore invalid frames
        }
      });

      ws.on('close', () => {
        if (userSockets.has(userId)) {
          userSockets.get(userId).delete(ws);
          if (userSockets.get(userId).size === 0) {
            userSockets.delete(userId);
          }
        }

        if (user.walletAddress) {
          const wallet = user.walletAddress.toLowerCase();
          if (walletSockets.has(wallet)) {
            walletSockets.get(wallet).delete(ws);
            if (walletSockets.get(wallet).size === 0) {
              walletSockets.delete(wallet);
            }
          }
        }

        console.log(`[WebSocket] Disconnected: ${user.username || userId}`);
      });
    } catch (err) {
      console.warn('[WebSocket] Auth error on connection:', err.message);
      ws.close(1008, 'Authentication failed');
    }
  });

  // Heartbeat ping every 30 seconds
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WebSocket] Server initialized on path /ws');
  return wss;
}

/**
 * Send real-time trade signal to a specific follower by userId or walletAddress
 */
export function sendSignalToFollower(followerIdentifier, signalData) {
  const targetId = String(followerIdentifier).toLowerCase();
  const sockets = userSockets.get(followerIdentifier) || walletSockets.get(targetId);

  let deliveredCount = 0;
  if (sockets && sockets.size > 0) {
    const payload = JSON.stringify({
      type: 'TRADE_SIGNAL',
      signal: signalData,
      timestamp: Date.now(),
    });

    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        deliveredCount++;
      }
    });
  }

  return deliveredCount;
}

/**
 * Broadcast event to all connected users
 */
export function broadcastToAll(messageData) {
  if (!wssInstance) return 0;
  const payload = JSON.stringify(messageData);
  let count = 0;
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      count++;
    }
  });
  return count;
}

