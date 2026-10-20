import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'kitchen-db.json');

export interface PushSubscriptionRecord {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userRole?: string;
  userName?: string;
  updatedAt?: number;
}

export interface PushPayloadMessage {
  id: string;
  title: string;
  body: string;
  tag?: string;
  urgent?: boolean;
  url?: string;
  timestamp: number;
}

export interface KitchenServerState {
  initialized?: boolean;
  tasks?: Array<Record<string, any>>;
  logs?: unknown[];
  staffList?: unknown[];
  toolbarItems?: unknown[];
  deleteRequests?: unknown[];
  notifications?: Array<Record<string, any>>;
  recipes?: unknown[];
  inventory?: unknown[];
  vapidKeys?: {
    publicKey: string;
    privateKeyJwk: crypto.JsonWebKey;
  };
  pushSubscriptions?: PushSubscriptionRecord[];
  latestPushMessage?: PushPayloadMessage;
  lastManager1430Date?: string;
  updatedAt: number;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str: string): Buffer {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

function ensureVapidKeys(state: KitchenServerState): {
  publicKey: string;
  privateKeyJwk: crypto.JsonWebKey;
} {
  if (state.vapidKeys?.publicKey && state.vapidKeys?.privateKeyJwk) {
    return state.vapidKeys;
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });

  const xBuf = base64UrlDecode(pubJwk.x!);
  const yBuf = base64UrlDecode(pubJwk.y!);
  const uncompressedPub = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]);

  const keys = {
    publicKey: base64UrlEncode(uncompressedPub),
    privateKeyJwk: privJwk,
  };
  state.vapidKeys = keys;
  return keys;
}

function createVapidAuthHeader(
  endpoint: string,
  vapidKeys: { publicKey: string; privateKeyJwk: crypto.JsonWebKey }
): string {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = base64UrlEncode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp,
        sub: 'mailto:admin@beppro.local',
      })
    )
  );

  const unsignedToken = `${header}.${payload}`;
  const privKeyObj = crypto.createPrivateKey({
    key: vapidKeys.privateKeyJwk,
    format: 'jwk',
  });

  const signature = crypto.sign('SHA256', Buffer.from(unsignedToken), {
    key: privKeyObj,
    dsaEncoding: 'ieee-p1363',
  });

  const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;
  return `vapid t=${jwt}, k=${vapidKeys.publicKey}`;
}

function encryptWebPushPayload(
  payloadText: string,
  uaPublicKeyB64: string,
  authSecretB64: string
): Buffer {
  const uaPub = base64UrlDecode(uaPublicKeyB64);
  const authSecret = base64UrlDecode(authSecretB64);
  const salt = crypto.randomBytes(16);

  const localEcdh = crypto.createECDH('prime256v1');
  const localPub = localEcdh.generateKeys();
  const sharedSecret = localEcdh.computeSecret(uaPub);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, localPub]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));

  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0');
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, cekInfo, 16));

  const nonceInfo = Buffer.from('Content-Encoding: nonce\0');
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, nonceInfo, 12));

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const plainWithPadding = Buffer.concat([
    Buffer.from(payloadText, 'utf-8'),
    Buffer.from([0x02]),
  ]);
  const encrypted = Buffer.concat([cipher.update(plainWithPadding), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const rsBuf = Buffer.alloc(4);
  rsBuf.writeUInt32BE(4096, 0);
  const idLenBuf = Buffer.from([localPub.length]);

  return Buffer.concat([salt, rsBuf, idLenBuf, localPub, encrypted, authTag]);
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
  const vapidKeys = ensureVapidKeys(dbState);
  saveDb(dbState);

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

  // Gửi thông báo Web Push ngầm (chuẩn W3C VAPID + RFC 8291 aes128gcm) đánh thức điện thoại ngay cả khi đã tắt / kill app
  const dispatchWebPushToAll = async (pushMsg: PushPayloadMessage, targetRole?: string) => {
    dbState.latestPushMessage = pushMsg;
    const subs = Array.isArray(dbState.pushSubscriptions) ? [...dbState.pushSubscriptions] : [];
    if (subs.length === 0) return;

    const payloadJson = JSON.stringify(pushMsg);
    const deadEndpoints = new Set<string>();

    await Promise.allSettled(
      subs.map(async (sub) => {
        if (!sub?.endpoint) return;
        if (targetRole === 'manager_or_admin' && sub.userRole && sub.userRole === 'staff') {
          return;
        }
        try {
          const authHeader = createVapidAuthHeader(sub.endpoint, vapidKeys);
          const headers: Record<string, string> = {
            Authorization: authHeader,
            TTL: '86400',
            Urgency: pushMsg.urgent ? 'high' : 'normal',
          };

          let bodyBuf: Buffer | undefined;
          if (sub.keys?.p256dh && sub.keys?.auth) {
            bodyBuf = encryptWebPushPayload(payloadJson, sub.keys.p256dh, sub.keys.auth);
            headers['Content-Encoding'] = 'aes128gcm';
            headers['Content-Type'] = 'application/octet-stream';
            headers['Content-Length'] = String(bodyBuf.length);
          } else {
            headers['Content-Length'] = '0';
          }

          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers,
            body: bodyBuf ? new Uint8Array(bodyBuf) : undefined,
          });

          if (res.status === 404 || res.status === 410) {
            deadEndpoints.add(sub.endpoint);
          }
        } catch {
          // ignore network error for single subscription
        }
      })
    );

    if (deadEndpoints.size > 0 && Array.isArray(dbState.pushSubscriptions)) {
      dbState.pushSubscriptions = dbState.pushSubscriptions.filter(
        (s) => !deadEndpoints.has(s.endpoint)
      );
      saveDb(dbState);
    }
  };

  // Bộ lập lịch chạy ngầm trên Server 24/7 (kể cả khi tất cả điện thoại đều tắt / kill app)
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    const now = new Date();
    const nowMs = Date.now();
    let changed = false;

    // 1. Tự động Reset các đầu việc Daily sau 24h trên Server & bắn Push ngầm
    if (Array.isArray(dbState.tasks) && dbState.tasks.length > 0) {
      const resetTitles: string[] = [];
      const nextTasks = dbState.tasks.map((t) => {
        const isDaily = (t.taskType || 'daily') === 'daily';
        if (
          isDaily &&
          t.completed &&
          typeof t.completedTimestamp === 'number' &&
          nowMs - t.completedTimestamp >= TWENTY_FOUR_HOURS_MS
        ) {
          resetTitles.push(String(t.title || 'Đầu việc'));
          return {
            ...t,
            completed: false,
            completedAt: undefined,
            completedTimestamp: undefined,
            completedBy: undefined,
            completedById: undefined,
            completedByRole: undefined,
          };
        }
        return t;
      });

      if (resetTitles.length > 0) {
        dbState.tasks = nextTasks;
        const notifItem = {
          id: `notif-${nowMs}-daily`,
          actorName: 'Hệ Thống Bếp',
          actorRole: 'admin',
          actionText: `đã tự động reset ${resetTitles.length} việc Daily sau 24h:`,
          targetText: resetTitles.join(', '),
          createdAtMs: nowMs,
          type: 'system',
        };
        dbState.notifications = [notifItem, ...(dbState.notifications || [])].slice(0, 40);
        changed = true;

        dispatchWebPushToAll({
          id: notifItem.id,
          title: '🔄 [Bếp Pro] Tự động làm mới Checklist 24h',
          body: `Đã tự động reset ${resetTitles.length} đầu việc Daily: ${resetTitles.slice(0, 2).join(', ')}`,
          tag: 'bep-pro-daily-reset',
          urgent: false,
          url: '/',
          timestamp: nowMs,
        });
      }
    }

    // 2. Tự động nhắc @manager lúc 14:30 chiều hàng ngày (theo múi giờ Việt Nam UTC+7) kể cả khi tắt app
    const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const vnDateStr = vnTime.toLocaleDateString('vi-VN');
    if (vnTime.getHours() === 14 && vnTime.getMinutes() >= 30 && dbState.lastManager1430Date !== vnDateStr) {
      dbState.lastManager1430Date = vnDateStr;
      const taskArr = Array.isArray(dbState.tasks) ? dbState.tasks : [];
      const completedCount = taskArr.filter((t) => t.completed).length;
      const totalCount = taskArr.length;
      const urgentPendingCount = taskArr.filter(
        (t) => !t.completed && (t.taskType === 'urgent_today' || t.priority === 'Gấp' || t.priority === 'Tối khẩn')
      ).length;

      const notifItem = {
        id: `notif-${nowMs}-1430`,
        actorName: 'Lịch Kiểm Tra 14:30',
        actorRole: 'manager',
        actionText: 'nhắc @manager kiểm tra tiến độ Checklist ca bếp',
        targetText: `Hoàn thành ${completedCount}/${totalCount} việc`,
        createdAtMs: nowMs,
        type: 'system',
      };
      dbState.notifications = [notifItem, ...(dbState.notifications || [])].slice(0, 40);
      changed = true;

      dispatchWebPushToAll(
        {
          id: notifItem.id,
          title: '⏰ [14:30] Nhắc @manager Kiểm Tra Checklist Bếp',
          body: `Tiến độ ca bếp: ${completedCount}/${totalCount} việc đã xong (${urgentPendingCount} việc gấp chờ làm).`,
          tag: 'bep-pro-1430-check',
          urgent: true,
          url: '/',
          timestamp: nowMs,
        },
        'manager_or_admin'
      );
    }

    if (changed) {
      dbState.updatedAt = nowMs;
      saveDb(dbState);
      broadcastSse({
        type: 'STATE_UPDATED',
        senderId: 'server-cron',
        state: dbState,
        timestamp: nowMs,
      });
    }
  }, 30000);

  // GET /api/push/vapid-public-key - Trả về Public Key để thiết bị đăng ký nhận thông báo ngầm khi tắt app
  router.get('/api/push/vapid-public-key', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        publicKey: vapidKeys.publicKey,
        subscribersCount: Array.isArray(dbState.pushSubscriptions)
          ? dbState.pushSubscriptions.length
          : 0,
      })
    );
  });

  // POST /api/push/subscribe - Lưu đăng ký Web Push của điện thoại/máy tính
  router.post('/api/push/subscribe', (req, res) => {
    const { subscription, userId, userRole, userName } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ ok: false, error: 'Missing subscription endpoint' });
      return;
    }

    const list = Array.isArray(dbState.pushSubscriptions) ? [...dbState.pushSubscriptions] : [];
    const existingIdx = list.findIndex((s) => s.endpoint === subscription.endpoint);
    const record: PushSubscriptionRecord = {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: subscription.keys,
      userId,
      userRole,
      userName,
      updatedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.push(record);
    }
    dbState.pushSubscriptions = list;
    saveDb(dbState);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, subscribersCount: list.length }));
  });

  // GET /api/push/latest - Cho phép Service Worker lấy thông báo mới nhất khi thức dậy ngầm
  router.get('/api/push/latest', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        latestPushMessage: dbState.latestPushMessage || null,
        latestNotification:
          Array.isArray(dbState.notifications) && dbState.notifications.length > 0
            ? dbState.notifications[0]
            : null,
        updatedAt: dbState.updatedAt,
      })
    );
  });

  // POST /api/push/test - Gửi thử thông báo ngầm (có thể hẹn trễ 3 giây để người dùng kịp khóa màn hình / tắt app thử nghiệm)
  router.post('/api/push/test', (req, res) => {
    const { senderName, delayMs } = req.body || {};
    const waitTime = Math.min(Math.max(Number(delayMs) || 0, 0), 10000);
    const msg: PushPayloadMessage = {
      id: `push-test-${Date.now()}`,
      title: '🔔 [Bếp Pro] Hoạt động ngầm đã sẵn sàng!',
      body: `Thông báo thử từ ${senderName || 'Bếp Pro'} — Kể cả khi khóa màn hình hoặc đóng/kill app, bạn vẫn nhận được chuông báo việc gấp!`,
      tag: `bep-pro-test-${Date.now()}`,
      urgent: true,
      url: '/',
      timestamp: Date.now(),
    };

    setTimeout(() => {
      dispatchWebPushToAll(msg);
    }, waitTime);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, scheduledInMs: waitTime }));
  });

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

    const prevTopNotifId =
      Array.isArray(dbState.notifications) && dbState.notifications.length > 0
        ? dbState.notifications[0]?.id
        : undefined;

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

    // Bắn thông báo Web Push ngầm cho các thiết bị đã tắt / kill app
    if (notification && typeof notification === 'object') {
      const nowMs = Date.now();
      if (notification.kind === 'TASK_ASSIGNED' && notification.taskTitle) {
        const isUrgent = Boolean(
          notification.isUrgent ||
            notification.priority === 'Gấp' ||
            notification.priority === 'Tối khẩn'
        );
        const assignedBy = notification.assignedBy || 'Trưởng Ca';
        const assignedName = notification.assignedStaffName || 'Toàn bộ ca bếp';
        dispatchWebPushToAll({
          id: `push-assign-${nowMs}`,
          title: isUrgent
            ? `🚨 VIỆC GẤP MỚI TỪ TRƯỞNG CA (${assignedBy})`
            : `👨‍🍳 Giao việc mới: ${assignedName}`,
          body: `"${notification.taskTitle}" — Giao bởi ${assignedBy} cho ${assignedName}`,
          tag: `bep-pro-task-${nowMs}`,
          urgent: isUrgent,
          url: '/',
          timestamp: nowMs,
        });
      } else if (notification.kind === 'TASK_TOGGLED' && notification.isCompleted && notification.taskTitle) {
        dispatchWebPushToAll({
          id: `push-done-${nowMs}`,
          title: '✅ [Bếp Pro] Đầu việc hoàn tất',
          body: `${notification.staffName || 'Nhân sự'} vừa hoàn thành: "${notification.taskTitle}"`,
          tag: `bep-pro-done-${nowMs}`,
          urgent: false,
          url: '/',
          timestamp: nowMs,
        });
      } else if (notification.kind === 'DELETE_REQUEST' && notification.newRequestLabel) {
        dispatchWebPushToAll(
          {
            id: `push-del-${nowMs}`,
            title: '🛡️ [Admin] Yêu cầu duyệt xóa mới',
            body: `${notification.requesterName || 'Trưởng ca'} yêu cầu xóa: "${notification.newRequestLabel}"`,
            tag: `bep-pro-del-${nowMs}`,
            urgent: true,
            url: '/',
            timestamp: nowMs,
          },
          'manager_or_admin'
        );
      } else if (notification.kind === 'MANAGER_1430_CHECK') {
        dispatchWebPushToAll(
          {
            id: `push-1430-${nowMs}`,
            title: '⏰ [14:30] Nhắc @manager Kiểm Tra Checklist Bếp',
            body: `Đã xong ${notification.completedCount ?? 0}/${notification.totalCount ?? 0} việc (${notification.urgentPendingCount ?? 0} việc gấp chờ làm).`,
            tag: 'bep-pro-1430-check',
            urgent: true,
            url: '/',
            timestamp: nowMs,
          },
          'manager_or_admin'
        );
      }
    } else if (
      Array.isArray(notifications) &&
      notifications.length > 0 &&
      notifications[0]?.id &&
      notifications[0].id !== prevTopNotifId
    ) {
      const top = notifications[0];
      const nowMs = Date.now();
      dispatchWebPushToAll({
        id: String(top.id),
        title: `🔔 [Bếp Pro] ${top.actorName || 'Hoạt động mới'}`,
        body: `${top.actorName || ''} ${top.actionText || ''} ${top.targetText ? `"${top.targetText}"` : ''}`.trim(),
        tag: `bep-pro-feed-${top.id}`,
        urgent: top.type === 'task_urgent',
        url: '/',
        timestamp: nowMs,
      });
    }

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
