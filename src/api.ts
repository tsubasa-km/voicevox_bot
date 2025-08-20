import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { settingsService } from '@/services/settings.js';
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

// ========== ユーザー音声設定 API ==========

// ユーザー音声設定取得（全設定）
app.get('/api/voice-settings', async (c) => {
  const guildId = c.req.query('guildId');
  const userId = c.req.query('userId');
  
  if (!guildId || !userId) {
    return c.json({ error: 'guildId and userId are required' }, 400);
  }
  
  try {
    const settings = await settingsService.getUserVoiceSettings(guildId, userId);
    return c.json(settings);
  } catch (error) {
    return c.json({ error: 'Failed to get user voice settings' }, 500);
  }
});

// ユーザー音声設定更新（全設定一括）
app.put('/api/voice-settings', async (c) => {
  try {
    const body = await c.req.json();
    const { guildId, userId, speakerId, pitchScale, speedScale } = body;
    
    if (!guildId || !userId) {
      return c.json({ error: 'guildId and userId are required' }, 400);
    }
    
    const settings: any = {};
    if (speakerId !== undefined) settings.speakerId = speakerId;
    if (pitchScale !== undefined) settings.pitchScale = pitchScale;
    if (speedScale !== undefined) settings.speedScale = speedScale;
    
    await settingsService.updateUserVoiceSettings(guildId, userId, settings);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update user voice settings' }, 500);
  }
});

// 話者ID取得・設定
app.get('/api/speaker', async (c) => {
  const guildId = c.req.query('guildId');
  const userId = c.req.query('userId');
  
  if (!guildId || !userId) {
    return c.json({ error: 'guildId and userId are required' }, 400);
  }
  
  try {
    const speakerId = await settingsService.getSpeakerId(guildId, userId);
    return c.json({ speakerId });
  } catch (error) {
    return c.json({ error: 'Failed to get speaker ID' }, 500);
  }
});

app.put('/api/speaker', async (c) => {
  try {
    const body = await c.req.json();
    const { guildId, userId, speakerId } = body;
    
    if (!guildId || !userId || !speakerId) {
      return c.json({ error: 'guildId, userId and speakerId are required' }, 400);
    }
    
    await settingsService.setSpeakerId(guildId, userId, speakerId);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update speaker ID' }, 500);
  }
});

// ピッチ取得・設定
app.get('/api/pitch', async (c) => {
  const guildId = c.req.query('guildId');
  const userId = c.req.query('userId');
  
  if (!guildId || !userId) {
    return c.json({ error: 'guildId and userId are required' }, 400);
  }
  
  try {
    const pitchScale = await settingsService.getPitchScale(guildId, userId);
    return c.json({ pitchScale });
  } catch (error) {
    return c.json({ error: 'Failed to get pitch scale' }, 500);
  }
});

app.put('/api/pitch', async (c) => {
  try {
    const body = await c.req.json();
    const { guildId, userId, pitchScale } = body;
    
    if (!guildId || !userId || pitchScale === undefined) {
      return c.json({ error: 'guildId, userId and pitchScale are required' }, 400);
    }
    
    await settingsService.setPitchScale(guildId, userId, Number(pitchScale));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update pitch scale' }, 500);
  }
});

// 速度取得・設定
app.get('/api/speed', async (c) => {
  const guildId = c.req.query('guildId');
  const userId = c.req.query('userId');
  
  if (!guildId || !userId) {
    return c.json({ error: 'guildId and userId are required' }, 400);
  }
  
  try {
    const speedScale = await settingsService.getSpeedScale(guildId, userId);
    return c.json({ speedScale });
  } catch (error) {
    return c.json({ error: 'Failed to get speed scale' }, 500);
  }
});

app.put('/api/speed', async (c) => {
  try {
    const body = await c.req.json();
    const { guildId, userId, speedScale } = body;
    
    if (!guildId || !userId || speedScale === undefined) {
      return c.json({ error: 'guildId, userId and speedScale are required' }, 400);
    }
    
    await settingsService.setSpeedScale(guildId, userId, Number(speedScale));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update speed scale' }, 500);
  }
});

// ========== サーバー設定 API ==========

// サーバー設定取得（全設定）
app.get('/api/server-settings', async (c) => {
  const guildId = c.req.query('guildId');
  
  if (!guildId) {
    return c.json({ error: 'guildId is required' }, 400);
  }
  
  try {
    const settings = await settingsService.getServerSettings(guildId);
    return c.json(settings);
  } catch (error) {
    return c.json({ error: 'Failed to get server settings' }, 500);
  }
});

// 自動接続設定取得・設定
app.get('/api/autoconnect', async (c) => {
  const guildId = c.req.query('guildId');
  
  if (!guildId) {
    return c.json({ error: 'guildId is required' }, 400);
  }
  
  try {
    const autoConnect = await settingsService.getAutoConnect(guildId);
    return c.json({ autoConnect });
  } catch (error) {
    return c.json({ error: 'Failed to get autoconnect setting' }, 500);
  }
});

app.put('/api/autoconnect', async (c) => {
  try {
    const body = await c.req.json();
    const { guildId, autoConnect } = body;
    
    if (!guildId || typeof autoConnect !== 'boolean') {
      return c.json({ error: 'guildId and autoConnect (boolean) are required' }, 400);
    }
    
    await settingsService.setAutoConnect(guildId, autoConnect);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update autoconnect setting' }, 500);
  }
});

// ========== チャンネル設定 API ==========

// チャンネルミュート状態取得・設定
app.get('/api/channel-mute', async (c) => {
  const guildId = c.req.query('guildId');
  const channelId = c.req.query('channelId');
  
  if (!guildId || !channelId) {
    return c.json({ error: 'guildId and channelId are required' }, 400);
  }
  
  try {
    const isMuted = await settingsService.getChannelMute(guildId, channelId);
    return c.json({ isMuted });
  } catch (error) {
    return c.json({ error: 'Failed to get channel mute status' }, 500);
  }
});

app.put('/api/channel-mute', async (c) => {
  try {
    const body = await c.req.json();
    const { guildId, channelId, muted } = body;
    
    if (!guildId || !channelId || typeof muted !== 'boolean') {
      return c.json({ error: 'guildId, channelId and muted (boolean) are required' }, 400);
    }
    
    await settingsService.setChannelMute(guildId, channelId, muted);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update channel mute status' }, 500);
  }
});

// ========== ヘルスチェック ==========

// ヘルスチェックエンドポイント
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== サーバー起動 ==========

const port = Number(process.env.API_PORT) || 3000;

Logger.info(`API Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});