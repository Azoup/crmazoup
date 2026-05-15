/**
 * Gateway WhatsApp (Baileys) — rode separado do Vite: npm install && npm start
 * Variáveis: PORT, SUPABASE_URL, SUPABASE_ANON_KEY
 * Sessões: ./sessions/<userId>/
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_ROOT = path.join(__dirname, 'sessions');
const baileysLogger = pino({ level: 'silent' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PORT = Number(process.env.PORT || 3847);

if (!fs.existsSync(SESSIONS_ROOT)) fs.mkdirSync(SESSIONS_ROOT, { recursive: true });

async function authMiddleware(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Configure SUPABASE_URL e SUPABASE_ANON_KEY no gateway.' });
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  try {
    const base = SUPABASE_URL.replace(/\/$/, '');
    const r = await fetch(`${base}/auth/v1/user`, {
      headers: {
        Authorization: auth,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!r.ok) return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    const user = await r.json();
    req.userId = user.id;
    next();
  } catch {
    return res.status(500).json({ error: 'Falha ao validar sessão' });
  }
}

function safeUserId(userId) {
  return String(userId).replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown';
}

function sessionDir(userId) {
  const dir = path.join(SESSIONS_ROOT, safeUserId(userId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function toWhatsAppJid(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length < 10) throw new Error('Telefone inválido');
  const with55 = d.startsWith('55') ? d : `55${d}`;
  return `${with55}@s.whatsapp.net`;
}

function clearSessionFiles(userId) {
  try {
    fs.rmSync(sessionDir(userId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function createUserCtx(userId) {
  const ctx = {
    sock: null,
    qrDataUrl: null,
    status: 'disconnected',
    phone: null,
    initPromise: null,
    reconnectTimer: null,
    lastError: null,
  };

  function scheduleReconnect(delayMs = 2000, wipeSession = false) {
    if (ctx.reconnectTimer) return;
    ctx.reconnectTimer = setTimeout(() => {
      ctx.reconnectTimer = null;
      if (ctx.status === 'connected' || ctx.status === 'qr') return;
      if (wipeSession) clearSessionFiles(userId);
      ctx.sock = null;
      ctx.initPromise = null;
      ensureSocket().catch((e) => {
        console.error(`[${userId}] reconnect failed`, e);
        ctx.lastError = e?.message || 'Falha ao reconectar';
        scheduleReconnect(4000, true);
      });
    }, delayMs);
  }

  function attachSocket(sock) {
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          ctx.qrDataUrl = await QRCode.toDataURL(qr);
          ctx.status = 'qr';
          ctx.lastError = null;
          console.log(`[${userId}] QR gerado`);
        } catch (e) {
          console.error(`[${userId}] QR encode error`, e);
          ctx.qrDataUrl = null;
        }
      }

      if (connection === 'connecting') {
        ctx.status = 'connecting';
      } else if (connection === 'open') {
        ctx.status = 'connected';
        ctx.qrDataUrl = null;
        ctx.lastError = null;
        const wid = sock.user?.id;
        ctx.phone = typeof wid === 'string' ? wid.split(':')[0] : null;
        console.log(`[${userId}] WhatsApp conectado`, ctx.phone);
      } else if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        const restartRequired = code === DisconnectReason.restartRequired;
        const badSession = loggedOut || restartRequired || code === 401 || code === 403;

        console.log(`[${userId}] connection closed`, code ?? 'unknown');

        ctx.status = 'disconnected';
        ctx.phone = null;
        ctx.sock = null;
        ctx.initPromise = null;

        if (loggedOut) {
          clearSessionFiles(userId);
          ctx.qrDataUrl = null;
          return;
        }

        // Sessão corrompida ou expirada: apaga arquivos e tenta de novo com QR novo
        if (badSession) {
          clearSessionFiles(userId);
          ctx.qrDataUrl = null;
        }

        scheduleReconnect(badSession ? 800 : 2000, badSession);
      }
    });
  }

  async function ensureSocket() {
    if (ctx.sock) return ctx.sock;
    if (ctx.initPromise) return ctx.initPromise;

    ctx.status = 'connecting';
    ctx.lastError = null;

    ctx.initPromise = (async () => {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir(userId));
      const sock = makeWASocket({
        auth: state,
        logger: baileysLogger,
        printQRInTerminal: false,
        browser: ['Azoup', 'CRM', '1.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });
      sock.ev.on('creds.update', saveCreds);
      attachSocket(sock);
      ctx.sock = sock;
      return sock;
    })();

    try {
      await ctx.initPromise;
    } catch (e) {
      ctx.lastError = e?.message || 'Erro ao iniciar socket';
      ctx.status = 'disconnected';
      ctx.sock = null;
      scheduleReconnect(3000, true);
      throw e;
    } finally {
      ctx.initPromise = null;
    }
    return ctx.sock;
  }

  function resetSession() {
    if (ctx.reconnectTimer) {
      clearTimeout(ctx.reconnectTimer);
      ctx.reconnectTimer = null;
    }
    if (ctx.sock) {
      try {
        ctx.sock.end(undefined);
      } catch {
        /* ignore */
      }
      ctx.sock = null;
    }
    ctx.initPromise = null;
    ctx.status = 'disconnected';
    ctx.phone = null;
    ctx.qrDataUrl = null;
    ctx.lastError = null;
    clearSessionFiles(userId);
  }

  return { ctx, ensureSocket, resetSession };
}

const userCtx = new Map();
function getCtx(userId) {
  if (!userCtx.has(userId)) userCtx.set(userId, createUserCtx(userId));
  return userCtx.get(userId);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function waitForQr(ctx, maxMs = 12000) {
  return new Promise((resolve) => {
    if (ctx.qrDataUrl || ctx.status === 'connected') {
      resolve();
      return;
    }
    const started = Date.now();
    const tick = setInterval(() => {
      if (ctx.qrDataUrl || ctx.status === 'connected' || Date.now() - started >= maxMs) {
        clearInterval(tick);
        resolve();
      }
    }, 250);
  });
}

app.get('/api/whatsapp/status', authMiddleware, async (req, res) => {
  try {
    const { ctx, ensureSocket } = getCtx(req.userId);
    if (!ctx.sock && !ctx.initPromise) {
      await ensureSocket();
    } else if (ctx.initPromise) {
      await ctx.initPromise.catch(() => undefined);
    }
    await waitForQr(ctx);
    res.json({
      status: ctx.status,
      qrDataUrl: ctx.qrDataUrl,
      phone: ctx.phone,
      error: ctx.lastError,
    });
  } catch (e) {
    console.error('status', e);
    res.status(500).json({ error: e?.message || 'Erro ao iniciar WhatsApp' });
  }
});

app.post('/api/whatsapp/reset', authMiddleware, async (req, res) => {
  try {
    const entry = getCtx(req.userId);
    entry.resetSession();
    await entry.ensureSocket();
    await waitForQr(entry.ctx);
    res.json({
      ok: true,
      status: entry.ctx.status,
      qrDataUrl: entry.ctx.qrDataUrl,
      phone: entry.ctx.phone,
      error: entry.ctx.lastError,
    });
  } catch (e) {
    console.error('reset', e);
    res.status(500).json({ error: e?.message || 'Erro ao gerar novo QR' });
  }
});

app.post('/api/whatsapp/logout', authMiddleware, async (req, res) => {
  try {
    const entry = getCtx(req.userId);
    if (entry.ctx.sock) {
      try {
        await entry.ctx.sock.logout();
      } catch {
        /* ignore */
      }
    }
    entry.resetSession();
    userCtx.delete(req.userId);
    res.json({ ok: true });
  } catch (e) {
    console.error('logout', e);
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

app.post('/api/whatsapp/send', authMiddleware, async (req, res) => {
  try {
    const { phone, message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem obrigatória' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Telefone obrigatório' });
    }
    const { ctx, ensureSocket } = getCtx(req.userId);
    const sock = await ensureSocket();
    if (ctx.status !== 'connected') {
      return res.status(409).json({ error: 'WhatsApp não conectado. Escaneie o QR na tela do CRM.' });
    }
    const jid = toWhatsAppJid(phone);
    await sock.sendMessage(jid, { text: message.slice(0, 4096) });
    res.json({ ok: true });
  } catch (e) {
    console.error('send', e);
    res.status(400).json({ error: e?.message || 'Falha ao enviar' });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp gateway em http://127.0.0.1:${PORT}`);
});
