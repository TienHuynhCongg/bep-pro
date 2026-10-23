import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';
import { MongoClient, Db } from 'mongodb';
import nodemailer from 'nodemailer';

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
  lastEmailBackupWeek?: string;
  lastEmailBackupDay?: string;
  isSeedReset?: boolean;
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

const MONGODB_URI = process.env.MONGODB_URI;
let mongoDb: Db | null = null;
let mongoClient: MongoClient | null = null;

async function initMongoConnection(onCloudStateLoaded?: (cloudState: KitchenServerState) => void) {
  if (!MONGODB_URI) {
    console.log('ℹ️ [Storage] Server đang lưu trữ trên Ổ đĩa Local (Thêm MONGODB_URI vào Render Environment Variables để lưu trữ Cloud vĩnh viễn không mất dữ liệu).');
    return;
  }
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 10000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGODB_DB_NAME || 'kitchen_db');
    console.log('✅ [MongoDB Atlas] ĐÃ KẾT NỐI CLOUD DATABASE LƯU TRỮ VĨNH VIỄN!');

    const col = mongoDb.collection('kitchen_state');
    const doc = await col.findOne({ _id: 'global_state' as any });
    if (doc && (Array.isArray(doc.tasks) || Array.isArray(doc.inventory))) {
      const { _id, ...rest } = doc as any;
      console.log(`✅ [MongoDB Atlas] Nạp thành công dữ liệu từ Cloud (updatedAt: ${rest.updatedAt})`);
      if (onCloudStateLoaded) {
        onCloudStateLoaded(rest as KitchenServerState);
      }
    } else {
      console.log('ℹ️ [MongoDB Atlas] Cloud Database chưa có bản ghi, sẽ khởi tạo từ dữ liệu local.');
    }
  } catch (err) {
    console.error('⚠️ [MongoDB Atlas] Kết nối thất bại, tự động dùng ổ đĩa local:', err);
  }
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
      if (!seedState.updatedAt) {
        seedState.updatedAt = Date.now();
      }
      seedState.isSeedReset = true;
      saveDb(seedState);
      console.log('Successfully initialized database from initial-data.json on server start.');
      return seedState;
    }
  } catch (err) {
    console.error('Error loading kitchen-db.json:', err);
  }
  return { updatedAt: Date.now(), initialized: true, isSeedReset: true };
}

function saveDb(state: KitchenServerState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');

    // Tự động đồng bộ ngay sang initial-data.json để khi commit Git & Deploy lại Render không bao giờ bị mất checklist/nhân sự
    try {
      const SEED_FILE = path.join(process.cwd(), 'initial-data.json');
      fs.writeFileSync(SEED_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Error saving kitchen-db.json:', err);
  }

  // Tự động đẩy vĩnh viễn lên MongoDB Atlas nếu có kết nối Cloud
  if (mongoDb) {
    mongoDb
      .collection('kitchen_state')
      .updateOne(
        { _id: 'global_state' as any },
        { $set: { ...state, _id: 'global_state' } },
        { upsert: true }
      )
      .catch((err) => console.error('Error saving to MongoDB Atlas:', err));
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

async function sendKitchenBackupEmail(
  state: KitchenServerState,
  overrideConfig?: {
    recipient?: string;
    senderEmail?: string;
    senderPassword?: string;
  }
) {
  const cfg = state.appConfig || {};
  const recipient = (overrideConfig?.recipient || cfg.emailBackupRecipient || '').trim();
  const senderEmail = (overrideConfig?.senderEmail || cfg.emailBackupSenderEmail || '').trim();
  const senderPassword = (overrideConfig?.senderPassword || cfg.emailBackupSenderPassword || '').trim().replace(/\s+/g, '');

  if (!recipient) {
    throw new Error('Chưa nhập địa chỉ Email người nhận bản sao lưu!');
  }
  if (!senderEmail || !senderPassword) {
    throw new Error('Chưa điền Gmail gửi đi hoặc Mật khẩu ứng dụng (Google App Password 16 ký tự)!');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: senderEmail,
      pass: senderPassword,
    },
  });

  // Kiểm tra xác thực SMTP Gmail
  await transporter.verify();

  // Hàm escape trường CSV
  const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  // 1. Tạo file CSV Tồn Kho Kiểm Kê
  const invList: any[] = Array.isArray(state.inventory) ? state.inventory : [];
  let invCsv = '\uFEFF"STT","Ngày","Tên Mặt Hàng / Nguyên Liệu","Tồn Đầu","Nhập Thêm","Tồn Thực Tế","Bán Ra / Hủy","Ngưỡng Báo Đặt","Đơn Vị","Tủ / Phân Loại","Trạng Thái","Người Kiểm","Giờ Kiểm"\n';
  invList.forEach((item: any, idx: number) => {
    invCsv +=
      [
        idx + 1,
        escapeCsv(item.dateStr || ''),
        escapeCsv(item.itemName || ''),
        escapeCsv(item.prevStock ?? 0),
        escapeCsv(item.importQty ?? 0),
        escapeCsv(item.stockQty ?? 0),
        escapeCsv(item.wasteQty ?? 0),
        escapeCsv(item.minThreshold ?? 0),
        escapeCsv(item.unit || 'phần'),
        escapeCsv(item.cabinetName || item.group || 'Chung'),
        escapeCsv(item.statusType === 'ton' ? 'Còn hàng' : 'Cần đặt hàng'),
        escapeCsv(item.createdBy || 'Admin'),
        escapeCsv(item.createdAt || ''),
      ].join(',') + '\n';
  });

  // 2. Tạo file CSV Công Việc Checklist
  const taskList: any[] = Array.isArray(state.tasks) ? state.tasks : [];
  let tasksCsv = '\uFEFF"STT","Tên Công Việc","Phân Loại","Ca Làm Việc","Mức Độ Ưu Tiên","Người Tạo","Giờ Tạo","Trạng Thái"\n';
  taskList.forEach((t: any, idx: number) => {
    tasksCsv +=
      [
        idx + 1,
        escapeCsv(t.title || ''),
        escapeCsv(t.category || 'Sơ chế'),
        escapeCsv(t.assignedShift || 'Hàng ngày'),
        escapeCsv(t.priority || 'Thường'),
        escapeCsv(t.createdBy || 'Admin'),
        escapeCsv(t.createdAt || ''),
        escapeCsv(t.completed ? 'Đã xong' : 'Chưa xong'),
      ].join(',') + '\n';
  });

  // 3. Tạo file CSV Công Thức Món & Cách Làm
  const recipeList: any[] = Array.isArray(state.recipes) ? state.recipes : [];
  let recipesCsv = '\uFEFF"STT","Tên Món","Phân Loại","Khẩu Phần","Thời Gian Nấu","Cách Làm / Quy Trình Thực Hiện","Định Lượng Nguyên Liệu"\n';
  recipeList.forEach((r: any, idx: number) => {
    const ingredientsStr = Array.isArray(r.ingredients)
      ? r.ingredients.map((ing: any) => `${ing.name || ''} (${ing.quantity || ''} ${ing.unit || ''})`).join('; ')
      : '';
    recipesCsv +=
      [
        idx + 1,
        escapeCsv(r.name || r.title || ''),
        escapeCsv(r.category || 'Món chính'),
        escapeCsv(r.servings || 1),
        escapeCsv(r.cookTime || ''),
        escapeCsv(r.instructions || r.steps || r.method || ''),
        escapeCsv(ingredientsStr),
      ].join(',') + '\n';
  });

  // 4. File JSON kỹ thuật đầy đủ để khôi phục khi cần
  const jsonContent = JSON.stringify(state, null, 2);

  // Thống kê nhanh
  const completedTasks = taskList.filter((t: any) => t.completed).length;
  const pendingTasks = taskList.length - completedTasks;
  const lowStockItems = invList.filter((i: any) => {
    const stock = Number(i.stockQty ?? 0);
    const min = Number(i.minThreshold ?? 0);
    return i.statusType === 'het' || (min > 0 && stock <= min);
  });

  const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const dateFormatted = `${String(nowVN.getUTCDate()).padStart(2, '0')}/${String(nowVN.getUTCMonth() + 1).padStart(2, '0')}/${nowVN.getUTCFullYear()} ${String(nowVN.getUTCHours()).padStart(2, '0')}:${String(nowVN.getUTCMinutes()).padStart(2, '0')}`;
  const fileDateTag = `${nowVN.getUTCFullYear()}-${String(nowVN.getUTCMonth() + 1).padStart(2, '0')}-${String(nowVN.getUTCDate()).padStart(2, '0')}`;

  let lowStockRowsHtml = '';
  if (lowStockItems.length > 0) {
    lowStockRowsHtml = lowStockItems
      .slice(0, 15)
      .map(
        (item: any) => `
      <tr style="border-bottom: 1px solid #fee2e2;">
        <td style="padding: 8px 12px; font-weight: bold; color: #991b1b;">${item.itemName || 'Món'}</td>
        <td style="padding: 8px 12px; text-align: center; color: #b91c1c; font-weight: bold;">${item.stockQty ?? 0} ${item.unit || 'phần'}</td>
        <td style="padding: 8px 12px; text-align: center; color: #6b7280;">${item.minThreshold ?? 0} ${item.unit || 'phần'}</td>
        <td style="padding: 8px 12px; text-align: center; color: #4b5563;">${item.cabinetName || 'Chung'}</td>
      </tr>
    `
      )
      .join('');
  }

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">BẾP PRO - BÁO CÁO SAO LƯU DỮ LIỆU ĐỊNH KỲ</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Thời gian tạo: <b>${dateFormatted}</b></p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-top: 0;">
          Xin chào Quản lý Bếp,<br/>
          Hệ thống <b>Bếp Pro</b> vừa tự động sao lưu và đóng gói toàn bộ dữ liệu của bạn. Các file đính kèm dạng Excel (.csv UTF-8) giúp bạn mở xem trực tiếp trên điện thoại rất thuận tiện, không cần thao tác kỹ thuật với file JSON.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: bold;">Kiểm Tồn Kho</div>
            <div style="font-size: 20px; font-weight: bold; color: #15803d; margin: 4px 0;">${invList.length} <span style="font-size: 12px; font-weight: normal;">món</span></div>
            <div style="font-size: 11px; color: #16a34a;">${lowStockItems.length} món sắp hết / cần đặt</div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: #1e40af; font-weight: bold;">Công Việc Checklist</div>
            <div style="font-size: 20px; font-weight: bold; color: #1d4ed8; margin: 4px 0;">${taskList.length} <span style="font-size: 12px; font-weight: normal;">việc</span></div>
            <div style="font-size: 11px; color: #2563eb;">${completedTasks} xong • ${pendingTasks} còn lại</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: #92400e; font-weight: bold;">Công Thức & Quy Trình</div>
            <div style="font-size: 20px; font-weight: bold; color: #b45309; margin: 4px 0;">${recipeList.length} <span style="font-size: 12px; font-weight: normal;">món</span></div>
            <div style="font-size: 11px; color: #d97706;">Bao gồm cách làm</div>
          </div>
          <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: #5b21b6; font-weight: bold;">Nhân Sự Bếp</div>
            <div style="font-size: 20px; font-weight: bold; color: #6d28d9; margin: 4px 0;">${Array.isArray(state.staffList) ? state.staffList.length : 0} <span style="font-size: 12px; font-weight: normal;">nhân sự</span></div>
            <div style="font-size: 11px; color: #7c3aed;">Đang hoạt động</div>
          </div>
        </div>

        ${
          lowStockItems.length > 0
            ? `
          <div style="margin: 20px 0; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden;">
            <div style="background: #fee2e2; padding: 10px 14px; font-size: 12px; font-weight: bold; color: #991b1b;">
              ⚠️ CẢNH BÁO: ${lowStockItems.length} MẶT HÀNG SẮP HẾT CẦN ĐẶT THÊM
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #fff1f2; color: #881337; text-align: left;">
                  <th style="padding: 8px 12px;">Mặt hàng</th>
                  <th style="padding: 8px 12px; text-align: center;">Tồn hiện tại</th>
                  <th style="padding: 8px 12px; text-align: center;">Ngưỡng đặt</th>
                  <th style="padding: 8px 12px; text-align: center;">Tủ / Khu vực</th>
                </tr>
              </thead>
              <tbody>
                ${lowStockRowsHtml}
              </tbody>
            </table>
          </div>
        `
            : ''
        }

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-top: 20px; font-size: 12px; color: #4b5563; line-height: 1.6;">
          <b style="color: #111827;">📎 4 Tệp đính kèm trong thư:</b>
          <ul style="margin: 6px 0 0 0; padding-left: 20px;">
            <li><b>Bao-Cao-Ton-Kho.csv</b>: Mở bằng Excel trên điện thoại để tra cứu số lượng tồn kho.</li>
            <li><b>Danh-Sach-Cong-Viec.csv</b>: Bảng Excel danh sách công việc checklist.</li>
            <li><b>Cong-Thuc-Mon-An.csv</b>: Bảng Excel công thức, cách làm và định lượng món.</li>
            <li><b>Kitchen-Backup-Full.json</b>: Tệp kỹ thuật chứa toàn bộ dữ liệu để khôi phục trong Admin nếu xảy ra sự cố.</li>
          </ul>
        </div>
      </div>

      <div style="background: #f3f4f6; padding: 14px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb;">
        Hệ Thống Quản Lý Bếp Pro • Tự động gửi bảo vệ dữ liệu nhà hàng
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Bếp Pro Backup" <${senderEmail}>`,
    to: recipient,
    subject: `📦 [Bếp Pro] Sao lưu dữ liệu (${fileDateTag}) - ${invList.length} món tồn, ${taskList.length} việc`,
    html: htmlBody,
    attachments: [
      {
        filename: `Bao-Cao-Ton-Kho-${fileDateTag}.csv`,
        content: invCsv,
        contentType: 'text/csv; charset=utf-8',
      },
      {
        filename: `Danh-Sach-Cong-Viec-${fileDateTag}.csv`,
        content: tasksCsv,
        contentType: 'text/csv; charset=utf-8',
      },
      {
        filename: `Cong-Thuc-Mon-An-${fileDateTag}.csv`,
        content: recipesCsv,
        contentType: 'text/csv; charset=utf-8',
      },
      {
        filename: `Kitchen-Backup-Full-${fileDateTag}.json`,
        content: jsonContent,
        contentType: 'application/json; charset=utf-8',
      },
    ],
  });

  return { ok: true, recipient, sentAt: Date.now() };
}

export function createKitchenApiMiddleware() {
  const router = express.Router();
  router.use(express.json({ limit: '5mb' }));

  let dbState: KitchenServerState = loadDb();
  const vapidKeys = ensureVapidKeys(dbState);
  saveDb(dbState);

  const sseClients = new Set<ServerResponse>();

  // Nạp từ Cloud Database (MongoDB Atlas) nếu có cấu hình
  initMongoConnection((cloudState) => {
    dbState = cloudState;
    ensureVapidKeys(dbState);
    broadcastSse({
      type: 'STATE_UPDATED',
      senderId: 'server-mongo-init',
      state: dbState,
      timestamp: Date.now(),
    });
  });

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

    // 4. Tự động gửi Email sao lưu dữ liệu (Hàng tuần vào thứ Hai hoặc Hàng ngày theo cấu hình)
    const emailConfig = dbState.appConfig || {};
    if (
      emailConfig.emailBackupEnabled !== false &&
      emailConfig.emailBackupRecipient &&
      emailConfig.emailBackupSenderEmail &&
      emailConfig.emailBackupSenderPassword
    ) {
      const freq = emailConfig.emailBackupFrequency || 'weekly';
      const vnHourVal = vnTime.getHours();
      let shouldSendEmail = false;

      // Tính ISO week key: YYYY-Www
      const tempDate = new Date(Date.UTC(vnTime.getFullYear(), vnTime.getMonth(), vnTime.getDate()));
      tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      const currentWeekKey = `${tempDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

      if (freq === 'daily') {
        if (vnHourVal >= 7 && dbState.lastEmailBackupDay !== vnDateStr) {
          shouldSendEmail = true;
        }
      } else {
        // Hàng tuần: Gửi vào tuần mới (từ 7h sáng thứ Hai trở đi, hoặc bất kỳ khi nào server mở trong tuần đó)
        if (vnHourVal >= 7 && dbState.lastEmailBackupWeek !== currentWeekKey) {
          shouldSendEmail = true;
        }
      }

      if (shouldSendEmail) {
        dbState.lastEmailBackupWeek = currentWeekKey;
        dbState.lastEmailBackupDay = vnDateStr;
        if (!dbState.appConfig) dbState.appConfig = {};
        dbState.appConfig.lastEmailBackupAt = nowMs;
        changed = true;

        sendKitchenBackupEmail(dbState)
          .then(() => {
            console.log(`📧 [Auto Backup Email] Đã tự động gửi email sao lưu thành công tới ${emailConfig.emailBackupRecipient}`);
          })
          .catch((err) => {
            console.error('⚠️ [Auto Backup Email] Tự động gửi email sao lưu thất bại:', err?.message || err);
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

  // GET /api/db-status - Kiểm tra trạng thái lưu trữ (Cloud Database vĩnh viễn hay Local Disk)
  router.get('/api/db-status', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        isCloudConnected: Boolean(mongoDb),
        storageMode: mongoDb ? 'MongoDB Atlas (Lưu trữ Cloud vĩnh viễn)' : 'Local Disk (Ổ đĩa máy chủ Render)',
        hasMongoUriConfigured: Boolean(MONGODB_URI),
        updatedAt: dbState.updatedAt,
        tasksCount: Array.isArray(dbState.tasks) ? dbState.tasks.length : 0,
        inventoryCount: Array.isArray(dbState.inventory) ? dbState.inventory.length : 0,
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
      // Admin hoặc người mới đăng ký / thêm nhân sự mới vào danh sách
      if (
        senderRole === 'admin' ||
        !dbState.staffList ||
        dbState.staffList.length === 0 ||
        staffList.length > (dbState.staffList?.length || 0)
      ) {
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

  // GET /api/health - Endpoint Keep-Alive chống ngủ đông Render & kiểm tra trạng thái
  router.get('/api/health', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        status: 'online',
        timestamp: Date.now(),
        uptime: Math.floor(process.uptime()),
        tasksCount: dbState.tasks?.length || 0,
        inventoryCount: dbState.inventory?.length || 0,
      })
    );
  });

  router.get('/api/ping', (_req, res) => {
    res.status(200).send('pong');
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

  // POST /api/admin/save-email-config - Lưu cấu hình Email tự động sao lưu định kỳ
  router.post('/api/admin/save-email-config', (req, res) => {
    try {
      const {
        emailBackupEnabled,
        emailBackupRecipient,
        emailBackupSenderEmail,
        emailBackupSenderPassword,
        emailBackupFrequency,
      } = req.body || {};

      if (!dbState.appConfig) dbState.appConfig = {};
      dbState.appConfig = {
        ...dbState.appConfig,
        emailBackupEnabled: emailBackupEnabled !== false,
        emailBackupRecipient: (emailBackupRecipient || '').trim(),
        emailBackupSenderEmail: (emailBackupSenderEmail || '').trim(),
        emailBackupSenderPassword: (emailBackupSenderPassword || '').trim(),
        emailBackupFrequency: emailBackupFrequency === 'daily' ? 'daily' : 'weekly',
      };
      dbState.updatedAt = Date.now();
      saveDb(dbState);

      broadcastSse({
        type: 'STATE_UPDATED',
        senderId: 'admin-email-config',
        state: dbState,
        timestamp: Date.now(),
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, appConfig: dbState.appConfig }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Lỗi lưu cấu hình email' });
    }
  });

  // POST /api/admin/send-email-backup - Gửi ngay bản sao lưu về email (gửi thử hoặc thủ công)
  router.post('/api/admin/send-email-backup', async (req, res) => {
    try {
      const { recipient, senderEmail, senderPassword } = req.body || {};
      const result = await sendKitchenBackupEmail(dbState, {
        recipient,
        senderEmail,
        senderPassword,
      });

      if (!dbState.appConfig) dbState.appConfig = {};
      dbState.appConfig.lastEmailBackupAt = Date.now();
      saveDb(dbState);

      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: true,
          message: `Đã gửi bản sao lưu dữ liệu kèm 3 file Excel và 1 file JSON thành công tới: ${result.recipient}`,
        })
      );
    } catch (err: any) {
      console.error('Lỗi khi gửi email backup:', err);
      res.status(500).json({
        ok: false,
        error:
          err?.message ||
          'Không thể gửi email sao lưu. Vui lòng kiểm tra lại địa chỉ email hoặc Mật khẩu ứng dụng Google (16 chữ số).',
      });
    }
  });

  // GET /api/cron/email-backup - Cho phép Web Cron bên ngoài ping để kích hoạt gửi email sao lưu
  router.get('/api/cron/email-backup', async (_req, res) => {
    try {
      const result = await sendKitchenBackupEmail(dbState);
      if (!dbState.appConfig) dbState.appConfig = {};
      dbState.appConfig.lastEmailBackupAt = Date.now();
      saveDb(dbState);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Đã kích hoạt gửi email sao lưu thành công', result }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Lỗi khi kích hoạt gửi email sao lưu' });
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
