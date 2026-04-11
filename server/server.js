/**
 * SRCH Server — Proxy SearXNG + Compteur global partagé
 * Placé dans le dossier /server du repo existant SearXNG
 */

const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const SEARXNG_URL = process.env.SEARXNG_URL || 'https://moteur-server-xng.onrender.com';
const COUNT_FILE  = process.env.COUNT_FILE  || path.join(__dirname, '..', 'data', 'count.json');

// ─── UTILS ────────────────────────────────────────────────────────────────────

function ensureDataDir() {
    const dir = path.dirname(COUNT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readCount() {
    try {
        ensureDataDir();
        if (!fs.existsSync(COUNT_FILE)) return defaultCount();
        return JSON.parse(fs.readFileSync(COUNT_FILE, 'utf8'));
    } catch (e) {
        return defaultCount();
    }
}

function writeCount(data) {
    try {
        ensureDataDir();
        fs.writeFileSync(COUNT_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[count] Erreur écriture:', e.message);
    }
}

function defaultCount() {
    return { total: 0, lastAt: null, hist: {}, tabs: { general: 0, images: 0, news: 0, videos: 0 } };
}

function dayKey() {
    return new Date().toISOString().slice(0, 10);
}

function cleanHist(hist) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    Object.keys(hist).forEach(k => { if (new Date(k) < cutoff) delete hist[k]; });
    return hist;
}

function getLast7Days() {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
    });
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// ─── PROXY SEARXNG ────────────────────────────────────────────────────────────

app.get('/api/search', async (req, res) => {
    try {
        const params = new URLSearchParams(req.query);
        const response = await fetch(`${SEARXNG_URL}/search?${params}`, {
            headers: { 'Accept': 'application/json' },
            timeout: 25000
        });
        if (!response.ok) return res.status(response.status).json({ error: `SearXNG ${response.status}` });
        res.json(await response.json());
    } catch (e) {
        console.error('[proxy] search:', e.message);
        res.status(502).json({ error: e.message });
    }
});

app.get('/api/autocompleter', async (req, res) => {
    try {
        const params = new URLSearchParams(req.query);
        const response = await fetch(`${SEARXNG_URL}/autocompleter?${params}`, { timeout: 5000 });
        res.json(await response.json());
    } catch (e) {
        res.json([]);
    }
});

// ─── COMPTEUR GLOBAL ──────────────────────────────────────────────────────────

// GET /api/count — statistiques globales
app.get('/api/count', (req, res) => {
    const data  = readCount();
    const today = dayKey();
    const weekDays = getLast7Days();

    const weekCount = weekDays.reduce((s, d) => s + (data.hist[d] || 0), 0);
    const monthPfx  = today.slice(0, 7);
    const monthCount = Object.entries(data.hist)
        .filter(([k]) => k.startsWith(monthPfx))
        .reduce((s, [, v]) => s + v, 0);

    const hist7 = weekDays.map(d => ({ date: d, count: data.hist[d] || 0 }));

    res.json({
        total:  data.total,
        lastAt: data.lastAt,
        today:  data.hist[today] || 0,
        week:   weekCount,
        month:  monthCount,
        hist7,
        tabs:   data.tabs
    });
});

// POST /api/count — incrémenter
app.post('/api/count', (req, res) => {
    const validTabs = ['general', 'images', 'news', 'videos'];
    const tab = validTabs.includes(req.body?.tab) ? req.body.tab : 'general';

    const data  = readCount();
    const today = dayKey();

    data.total          = (data.total || 0) + 1;
    data.lastAt         = new Date().toISOString();
    data.hist           = cleanHist(data.hist || {});
    data.hist[today]    = (data.hist[today] || 0) + 1;
    data.tabs           = data.tabs || { general: 0, images: 0, news: 0, videos: 0 };
    data.tabs[tab]      = (data.tabs[tab] || 0) + 1;

    writeCount(data);
    res.json({ ok: true, total: data.total });
});

// DELETE /api/count — reset (protégé par RESET_SECRET)
app.delete('/api/count', (req, res) => {
    const secret = process.env.RESET_SECRET;
    if (secret && req.headers['x-reset-secret'] !== secret) {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    writeCount(defaultCount());
    res.json({ ok: true, message: 'Compteur réinitialisé' });
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
    const data = readCount();
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()) + 's', total: data.total, searxng: SEARXNG_URL });
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    ensureDataDir();
    if (!fs.existsSync(COUNT_FILE)) writeCount(defaultCount());
    console.log(`✅ srch-server :${PORT}  →  SearXNG: ${SEARXNG_URL}`);
    console.log(`   Compteur: ${COUNT_FILE}`);
});