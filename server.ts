import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'kitchen-db.json');

export interface KitchenServerState {
  initialized?: boolean;
  tasks?: unknown[];
  logs?: unknown[];
  staffList?: unknown[];
  toolbarItems?: unknown[];
  deleteRequests?: unknown[];
  notifications?: unknown[];
  recipes?: unknown[];
  inventory?: unknown[];
  updatedAt: number;
}

function loadDb(): KitchenServerState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading kitchen-db.json:', err);
  }
  return { updatedAt: Date.now() };
}

function saveDb(state: KitchenServerState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving kitchen-db.json:', err);
  }
}

export function createKitchenApiMiddleware() {
  const router = express.Router();
  router.use(express.json({ limit: '5mb' }));

  let dbState: KitchenServerState = loadDb();
  const sseClients = new Set<ServerResponse>();

  const broadcastSse = (payload: unknown) => {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(data);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  // GET /api/state - Lấy dữ liệu đồng bộ mới nhất từ Server
  router.get('/api/state', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        state: dbState,
        onlineConnections: sseClients.size,
      })
    );
  });

  // POST /api/sync - Đồng bộ dữ liệu từ bất kỳ máy iOS/Android/PC nào lên Server
  router.post('/api/sync', (req, res) => {
    const {
      tasks,
      logs,
      staffList,
      toolbarItems,
      deleteRequests,
      notifications,
      recipes,
      inventory,
      notification,
      senderId,
    } = req.body || {};

    dbState.initialized = true;
    if (Array.isArray(tasks)) dbState.tasks = tasks;
    if (Array.isArray(logs)) dbState.logs = logs;
    if (Array.isArray(staffList)) dbState.staffList = staffList;
    if (Array.isArray(toolbarItems)) dbState.toolbarItems = toolbarItems;
    if (Array.isArray(deleteRequests)) dbState.deleteRequests = deleteRequests;
    if (Array.isArray(notifications)) dbState.notifications = notifications;
    if (Array.isArray(recipes)) dbState.recipes = recipes;
    if (Array.isArray(inventory)) dbState.inventory = inventory;
    dbState.updatedAt = Date.now();

    saveDb(dbState);

    broadcastSse({
      type: 'STATE_UPDATED',
      senderId: senderId || '',
      state: dbState,
      notification: notification || null,
      timestamp: dbState.updatedAt,
    });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, updatedAt: dbState.updatedAt }));
  });

  // GET /api/events - Luồng Real-time SSE cho mọi thiết bị iOS / Android
  router.get('/api/events', (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', state: dbState, onlineConnections: sseClients.size + 1 })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // GET /api/ios-app.mobileconfig - Tạo bộ cài App trực tiếp cho iOS (iPhone/iPad) 100% Free
  router.get('/api/ios-app.mobileconfig', (req, res) => {
    const protocol = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.host || 'localhost:3000';
    const targetUrl = (req.query.url as string) || `${protocol}://${host}/`;

    const mobileConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>IgnoreManifestScope</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>Bếp Pro</string>
      <key>PayloadDescription</key>
      <string>Cài đặt ứng dụng Quản Lý Bếp (Bếp Pro) toàn màn hình cho iOS</string>
      <key>PayloadDisplayName</key>
      <string>Bếp Pro - Quản Lý Bếp</string>
      <key>PayloadIdentifier</key>
      <string>com.beppro.kitchenlog.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>A1B2C3D4-E5F6-4789-ABCD-1234567890AB</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${targetUrl}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Bộ cài đặt ứng dụng Bếp Pro (Kitchen Log Pro) chính thức cho iPhone &amp; iPad (100% Miễn phí).</string>
  <key>PayloadDisplayName</key>
  <string>Bếp Pro (iOS App)</string>
  <key>PayloadIdentifier</key>
  <string>com.beppro.kitchenlog.profile</string>
  <key>PayloadOrganization</key>
  <string>Kitchen Log Pro</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>F1E2D3C4-B5A6-4987-DCBA-0987654321FE</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

    res.setHeader('Content-Type', 'application/x-apple-aspen-config; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Bep-Pro-iOS.mobileconfig"');
    res.end(mobileConfigXml);
  });

  return router;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(createKitchenApiMiddleware());

  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Kitchen Log Pro Server đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

const isRunningUnderViteCli = process.argv.some((arg) => arg.includes('vite'));
if (!isRunningUnderViteCli) {
  startServer();
}
