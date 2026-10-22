import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DATA_DIR có thể trỏ tới ổ đĩa bền vững (VD: Render Disk mount /var/data) để dữ liệu không mất khi deploy.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
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
  appConfig?: Record<string, any>;
  vapidKeys?: {
    publicKey: string;
    privateKeyJwk: crypto.JsonWebKey;
  };
  pushSubscriptions?: PushSubscriptionRecord[];
  latestPushMessage?: PushPayloadMessage;
  lastManager1430Date?: string;
  lastHourlyReminderKey?: string;
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
    const SEED_FILE = path.join(process.cwd(), 'initial-data.json');
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.initialized || (Array.isArray(parsed.tasks) && parsed.tasks.length > 0))) {
        return parsed;
      }
    }
    // Nếu chưa có DB hoặc DB trống (ví dụ sau khi Deploy lên Render): nạp ngay từ initial-data.json
    if (fs.existsSync(SEED_FILE)) {
      const rawSeed = fs.readFileSync(SEED_FILE, 'utf-8').replace(/^\uFEFF/, '');
      const seedState = JSON.parse(rawSeed);
      seedState.initialized = true;
      seedState.updatedAt = Date.now();
      saveDb(seedState);
      console.log('Successfully initialized database from initial-data.json on server start.');
      return seedState;
    }
  } catch (err) {
    console.error('Error loading kitchen-db.json:', err);
  }
  return { updatedAt: Date.now(), initialized: true };
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

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function createAutoBackup(state: KitchenServerState, reason = 'admin_action'): string | null {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const tsStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const safeReason = String(reason || 'admin').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `backup_${tsStr}_${safeReason}.json`;
    const filepath = path.join(BACKUPS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(state, null, 2), 'utf-8');
    fs.writeFileSync(path.join(BACKUPS_DIR, 'backup_latest.json'), JSON.stringify(state, null, 2), 'utf-8');

    // Giữ lại 30 bản sao lưu gần nhất để bảo vệ dung lượng đĩa
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.json') && f !== 'backup_latest.json')
      .sort()
      .reverse();

    if (files.length > 30) {
      for (const oldFile of files.slice(30)) {
        try {
          fs.unlinkSync(path.join(BACKUPS_DIR, oldFile));
        } catch {
          // ignore
        }
      }
    }
    return filename;
  } catch (err) {
    console.error('Error creating auto backup:', err);
    return null;
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
            Urgency: 'high',
            'apns-priority': '10',
            'apns-push-type': 'alert',
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

          if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410) {
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

    // 3. Tự động nhắc việc chưa làm sau mỗi 1h (ví dụ 9h, 10h... nhắc: còn việc = số việc được giao - số việc đã làm)
    const vnHour = vnTime.getHours();
    const reminderKey = `${vnDateStr}-${vnHour}`;

    const config = dbState.appConfig || {};
    const reminderEnabled = config.hourlyReminderEnabled !== false;
    const startHour = typeof config.hourlyReminderStartHour === 'number' ? config.hourlyReminderStartHour : 8;
    const endHour = typeof config.hourlyReminderEndHour === 'number' ? config.hourlyReminderEndHour : 22;

    if (
      reminderEnabled &&
      vnHour >= startHour &&
      vnHour <= endHour &&
      dbState.lastHourlyReminderKey !== reminderKey
    ) {
      dbState.lastHourlyReminderKey = reminderKey;
      const taskArr = Array.isArray(dbState.tasks) ? dbState.tasks : [];
      const totalCount = taskArr.length;
      const completedCount = taskArr.filter((t) => t.completed).length;
      const pendingCount = Math.max(totalCount - completedCount, 0);

      if (totalCount > 0 && pendingCount > 0) {
        const notifItem = {
          id: `notif-${nowMs}-hourly-${vnHour}`,
          actorName: `Nhắc Việc ${vnHour}:00`,
          actorRole: 'manager',
          actionText: `thông báo còn ${pendingCount} việc chưa làm`,
          targetText: `Tiến độ: ${completedCount}/${totalCount} việc`,
          createdAtMs: nowMs,
          type: 'task_urgent',
        };
        dbState.notifications = [notifItem, ...(dbState.notifications || [])].slice(0, 40);
        changed = true;

        dispatchWebPushToAll({
          id: notifItem.id,
          title: `⏰ [${vnHour}:00] Nhắc Việc: Còn ${pendingCount} việc chưa làm!`,
          body: `Còn ${pendingCount} việc chưa làm. Các bạn vào kiểm tra và xử lý nhé!`,
          tag: `bep-pro-hourly-${vnHour}`,
          urgent: true,
          url: '/',
          timestamp: nowMs,
        });
      }
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

  // POST /api/push/test-hourly - Cho phép bấm thử nghiệm tính năng nhắc việc sau mỗi 1h ngay lập tức
  router.post('/api/push/test-hourly', (_req, res) => {
    const nowMs = Date.now();
    const now = new Date();
    const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const vnHour = vnTime.getHours();
    const taskArr = Array.isArray(dbState.tasks) ? dbState.tasks : [];
    const totalCount = taskArr.length;
    const completedCount = taskArr.filter((t) => t.completed).length;
    const pendingCount = Math.max(totalCount - completedCount, 0);

    const notifItem = {
      id: `notif-${nowMs}-hourly-test`,
      actorName: `Nhắc Việc ${vnHour}:00`,
      actorRole: 'manager',
      actionText: `thông báo còn ${pendingCount} việc chưa làm`,
      targetText: `Tiến độ: ${completedCount}/${totalCount} việc`,
      createdAtMs: nowMs,
      type: 'task_urgent',
    };
    dbState.notifications = [notifItem, ...(dbState.notifications || [])].slice(0, 40);
    dbState.updatedAt = nowMs;
    saveDb(dbState);

    broadcastSse({
      type: 'STATE_UPDATED',
      senderId: 'server-test-hourly',
      state: dbState,
      timestamp: nowMs,
    });

    dispatchWebPushToAll({
      id: notifItem.id,
      title: `⏰ [${vnHour}:00] Nhắc Việc: Còn ${pendingCount} việc chưa làm!`,
      body: `Còn ${pendingCount} việc chưa làm. Các bạn vào kiểm tra và hoàn tất checklist!`,
      tag: `bep-pro-hourly-${nowMs}`,
      urgent: true,
      url: '/',
      timestamp: nowMs,
    });

    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        vnHour,
        totalCount,
        completedCount,
        pendingCount,
      })
    );
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
      appConfig,
      notification,
      senderId,
      senderRole,
      senderName,
      actionReason,
    } = req.body || {};

    dbState.initialized = true;
    if (appConfig && typeof appConfig === 'object') {
      if (senderRole === 'admin' || !dbState.appConfig) {
        dbState.appConfig = appConfig;
      }
    }
    if (Array.isArray(toolbarItems)) {
      if (senderRole === 'admin' || !dbState.toolbarItems || dbState.toolbarItems.length === 0) {
        dbState.toolbarItems = toolbarItems;
      }
    }
    if (Array.isArray(staffList)) {
      // Chỉ Admin được phép thay đổi danh sách nhân sự
      if (senderRole === 'admin' || !dbState.staffList || dbState.staffList.length === 0) {
        dbState.staffList = staffList;
      } else {
        console.warn(`[Sync Security] Blocked non-admin (${senderRole || 'anonymous'}) from modifying staffList`);
      }
    }
    if (Array.isArray(tasks)) {
      // Admin hoặc Quản lý được phép cập nhật toàn bộ danh sách tasks
      if (senderRole === 'admin' || senderRole === 'manager' || !dbState.tasks || dbState.tasks.length === 0) {
        dbState.tasks = tasks;
      } else {
        // Staff chỉ được phép cập nhật trạng thái hoàn thành (complete/incomplete/note) của các task có sẵn
        if (Array.isArray(dbState.tasks) && dbState.tasks.length > 0) {
          const incomingMap = new Map(tasks.map((t: any) => [t.id, t]));
          dbState.tasks = dbState.tasks.map((existing: any) => {
            const incoming = incomingMap.get(existing.id);
            if (!incoming) return existing;
            return {
              ...existing,
              completed: Boolean(incoming.completed),
              completedAt: incoming.completedAt,
              completedTimestamp: incoming.completedTimestamp,
              completedBy: incoming.completedBy,
              completedById: incoming.completedById,
              completedByRole: incoming.completedByRole,
            };
          });
        } else {
          dbState.tasks = tasks;
        }
      }
    }
    if (Array.isArray(logs)) dbState.logs = logs;
    if (Array.isArray(deleteRequests)) dbState.deleteRequests = deleteRequests;
    if (Array.isArray(notifications)) dbState.notifications = notifications;
    if (Array.isArray(recipes)) dbState.recipes = recipes;
    if (Array.isArray(inventory)) dbState.inventory = inventory;
    dbState.updatedAt = Date.now();

    saveDb(dbState);

    // Tự động sao lưu dữ liệu mỗi khi Admin thao tác
    const isAdminAction =
      senderRole === 'admin' ||
      Boolean(appConfig || toolbarItems || staffList || deleteRequests);
    if (isAdminAction) {
      createAutoBackup(
        dbState,
        actionReason ||
          (appConfig
            ? 'admin_config'
            : toolbarItems
            ? 'admin_menu'
            : staffList
            ? 'admin_staff'
            : 'admin_action')
      );
    }

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
      if (
        notification.kind === 'TASK_ASSIGNED' &&
        notification.taskTitle &&
        (notification.assignedByRole === 'admin' || notification.assignedByRole === 'manager')
      ) {
        const isUrgent = Boolean(
          notification.isUrgent ||
            notification.priority === 'Gấp' ||
            notification.priority === 'Tối khẩn'
        );
        const roleLabel = notification.assignedByRole === 'admin' ? 'Bếp Trưởng' : 'Trưởng Ca';
        const assignedBy = notification.assignedBy || roleLabel;
        const assignedName = notification.assignedStaffName || 'Toàn bộ ca bếp';
        dispatchWebPushToAll({
          id: `push-assign-${nowMs}`,
          title: isUrgent
            ? `🚨 VIỆC GẤP MỚI TỪ ${roleLabel.toUpperCase()} (${assignedBy})`
            : `👨‍🍳 Giao việc mới từ ${roleLabel}: ${assignedName}`,
          body: `"${notification.taskTitle}" — Giao bởi ${assignedBy} cho ${assignedName}`,
          tag: `bep-pro-task-${nowMs}`,
          urgent: true,
          url: '/',
          timestamp: nowMs,
        });
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
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, updatedAt: dbState.updatedAt }));
  });

  // GET /api/admin/backups - Trả về danh sách các bản sao lưu tự động trên server
  router.get('/api/admin/backups', (_req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, backups: [] }));
        return;
      }
      const files = fs
        .readdirSync(BACKUPS_DIR)
        .filter((f) => f.startsWith('backup_') && f.endsWith('.json'))
        .map((f) => {
          const stat = fs.statSync(path.join(BACKUPS_DIR, f));
          return {
            filename: f,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            isLatest: f === 'backup_latest.json',
          };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, backups: files }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message });
    }
  });

  // POST /api/admin/create-backup - Tạo bản sao lưu thủ công ngay tức thì
  router.post('/api/admin/create-backup', (req, res) => {
    try {
      const { reason } = req.body || {};
      const filename = createAutoBackup(dbState, reason || 'manual_admin');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, filename, timestamp: Date.now() }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message });
    }
  });

  // POST /api/admin/restore-backup - Khôi phục dữ liệu từ 1 bản sao lưu tự động
  router.post('/api/admin/restore-backup', (req, res) => {
    try {
      const { filename } = req.body || {};
      if (
        !filename ||
        typeof filename !== 'string' ||
        filename.includes('..') ||
        filename.includes('/') ||
        filename.includes('\\')
      ) {
        res.status(400).json({ ok: false, error: 'Tên file không hợp lệ' });
        return;
      }
      const targetPath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(targetPath)) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy file sao lưu' });
        return;
      }
      const raw = fs.readFileSync(targetPath, 'utf-8').replace(/^\uFEFF/, '');
      const restored = JSON.parse(raw);
      if (!restored || typeof restored !== 'object') {
        res.status(400).json({ ok: false, error: 'File sao lưu bị hỏng' });
        return;
      }

      // Tạo sao lưu bản hiện tại trước khi khôi phục
      createAutoBackup(dbState, 'pre_restore');

      dbState = { ...restored, updatedAt: Date.now() };
      saveDb(dbState);

      broadcastSse({
        type: 'STATE_UPDATED',
        senderId: 'server-restore',
        state: dbState,
        timestamp: dbState.updatedAt,
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, restoredAt: dbState.updatedAt }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message });
    }
  });

  // GET /api/admin/download-backup/:filename - Tải 1 file sao lưu về máy
  router.get('/api/admin/download-backup/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      if (
        !filename ||
        filename.includes('..') ||
        filename.includes('/') ||
        filename.includes('\\')
      ) {
        res.status(400).send('Tên file không hợp lệ');
        return;
      }
      const targetPath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(targetPath)) {
        res.status(404).send('Không tìm thấy file');
        return;
      }
      res.download(targetPath, filename);
    } catch (err: any) {
      res.status(500).send(err?.message);
    }
  });

  // POST /api/admin/save-seed - Lưu toàn bộ dữ liệu hiện tại làm initial-data.json để đưa lên Git
  router.post('/api/admin/save-seed', (_req, res) => {
    try {
      const SEED_FILE = path.join(process.cwd(), 'initial-data.json');
      const seedCopy = { ...dbState, updatedAt: Date.now(), initialized: true };
      fs.writeFileSync(SEED_FILE, JSON.stringify(seedCopy, null, 2), 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Đã lưu initial-data.json thành công' }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Lỗi lưu initial-data.json' });
    }
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

  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(createKitchenApiMiddleware());
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

// Chỉ khởi động server khi chạy trực tiếp `tsx server.ts` (tránh chạy lặp khi vite.config.ts import file này)
const isRunningUnderViteCli = process.argv.some((arg) => arg.includes('vite'));
const isEntryFile = /server\.(ts|js|mjs)$/.test(process.argv[1] || '');
if (!isRunningUnderViteCli && isEntryFile && !process.env.KITCHEN_SERVER_STARTED) {
  process.env.KITCHEN_SERVER_STARTED = '1';
  startServer();
}
