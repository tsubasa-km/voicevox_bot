import type { Attachment, Message } from 'discord.js';
import { config } from '@/config.js';

const urlPattern = /https?:\/\/\S+/gi;
const customEmojiPattern = /<a?:([\w]+):\d+>/gi;
const imageExtensionPattern = /\.(apng|avif|bmp|gif|jpe?g|jfif|png|svg|webp|heic|heif)$/i;

function replaceUserMentions(message: Message, input: string): string {
  let content = input;

  message.mentions.users.forEach((user) => {
    const displayName = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    const patterns = [new RegExp(`<@${user.id}>`, 'g'), new RegExp(`<@!${user.id}>`, 'g')];
    patterns.forEach((pattern) => {
      content = content.replace(pattern, `${displayName}`);
    });
  });

  return content;
}

function replaceRoleMentions(message: Message, input: string): string {
  let content = input;
  message.mentions.roles.forEach((role) => {
    const pattern = new RegExp(`<@&${role.id}>`, 'g');
    content = content.replace(pattern, role.name);
  });
  return content;
}

function replaceChannelMentions(message: Message, input: string): string {
  let content = input;
  message.mentions.channels.forEach((channel) => {
    const pattern = new RegExp(`<#${channel.id}>`, 'g');
    const channelName = 'name' in channel && typeof channel.name === 'string' ? channel.name : 'チャンネル';
    content = content.replace(pattern, channelName);
  });
  return content;
}

function isImageAttachment(attachment: Attachment): boolean {
  const contentType = attachment.contentType?.toLowerCase();
  if (contentType?.startsWith('image/')) {
    return true;
  }
  return imageExtensionPattern.test(attachment.name ?? '');
}

export function formatMessageContent(message: Message): string {
  let content = message.content ?? '';
  const nonImageAttachments = message.attachments.filter((attachment) => !isImageAttachment(attachment));

  content = replaceUserMentions(message, content);
  content = replaceRoleMentions(message, content);
  content = replaceChannelMentions(message, content);

  content = content.replace(/@everyone/gi, 'みんな');
  content = content.replace(/@here/gi, 'その場にいるみんな');
  content = content.replace(urlPattern, 'URLリンク');
  content = content.replace(customEmojiPattern, (_match, name) => `カスタム絵文字 ${name}`);

  content = content.replace(/[\r\n]+/g, '、');
  content = content.replace(/\s{2,}/g, ' ');

  content = content.trim();

  if (!content && nonImageAttachments.size > 0) {
    content = '添付ファイル';
  }

  if (nonImageAttachments.size > 0) {
    const attachmentSummary = nonImageAttachments
      .map((attachment) => attachment.name ?? 'ファイル')
      .join('、');
    content = content ? `${content}、添付: ${attachmentSummary}` : `添付: ${attachmentSummary}`;
  }

  if (content.length > config.maxUtteranceLength) {
    content = `${content.slice(0, config.maxUtteranceLength)} 以下略`;
  }

  return content;
}
