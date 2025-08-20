import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { db } from '@/services/database.js';
import { Logger } from '@/utils/logger.js';

const app = new Hono();

// CORS設定
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// エラーハンドリングミドルウェア
app.onError((err, c) => {
  Logger.error('API Error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// ルートエンドポイント
app.get('/', (c) => {
  return c.text('VoiceVox Bot API Server');
});

// ユーザー音声設定取得
app.get('/api/:guildId/:userId/voice-settings', async (c) => {
  const { guildId, userId } = c.req.param();
  
  try {
    const settings = await db.getUserVoiceSettings(guildId, userId);
    return c.json(settings);
  } catch (error) {
    return c.json({ error: 'Failed to get user settings' }, 500);
  }
});

// ユーザー音声設定更新
app.put('/api/:guildId/:userId/voice-settings', async (c) => {
  const { guildId, userId } = c.req.param();
  
  try {
    const body = await c.req.json();
    const { setting, value } = body;
    
    if (!setting || value === undefined) {
      return c.json({ error: 'Setting and value are required' }, 400);
    }
    
    await db.setUserVoiceSetting(guildId, userId, setting, value);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update user settings' }, 500);
  }
});

// サーバー設定取得
app.get('/api/:guildId/settings', async (c) => {
  const { guildId } = c.req.param();
  
  try {
    const autoConnect = await db.getGuildAutoConnect(guildId);
    return c.json({ autoConnect });
  } catch (error) {
    return c.json({ error: 'Failed to get guild settings' }, 500);
  }
});

// サーバー設定更新
app.put('/api/:guildId/settings', async (c) => {
  const { guildId } = c.req.param();
  
  try {
    const body = await c.req.json();
    const { autoConnect } = body;
    
    if (typeof autoConnect !== 'boolean') {
      return c.json({ error: 'autoConnect must be a boolean' }, 400);
    }
    
    await db.setGuildAutoConnect(guildId, autoConnect);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update guild settings' }, 500);
  }
});

// チャンネルミュート状態取得
app.get('/api/:guildId/channels/:channelId/mute', async (c) => {
  const { guildId, channelId } = c.req.param();
  
  try {
    const isMuted = await db.isChannelMuted(guildId, channelId);
    return c.json({ isMuted });
  } catch (error) {
    return c.json({ error: 'Failed to get channel mute status' }, 500);
  }
});

// チャンネルミュート設定
app.put('/api/:guildId/channels/:channelId/mute', async (c) => {
  const { guildId, channelId } = c.req.param();
  
  try {
    const body = await c.req.json();
    const { muted } = body;
    
    if (typeof muted !== 'boolean') {
      return c.json({ error: 'muted must be a boolean' }, 400);
    }
    
    await db.setChannelMute(guildId, channelId, muted);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update channel mute status' }, 500);
  }
});

// ヘルスチェックエンドポイント
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = Number(process.env.API_PORT) || 3000;

Logger.info(`API Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
