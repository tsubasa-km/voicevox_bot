import emojiRegex from "emoji-regex";

export class TextFilter {
  /**
   * 読み上げに適さないテキストを除去またはクリーンアップする
   */
  static filterForSpeech(text: string): string {
    let filteredText = text;

    // 1. URL/URI の除去 (より包括的な正規表現)
    filteredText = this.removeUrls(filteredText);

    // 2. 絵文字の処理
    filteredText = this.processEmojis(filteredText);

    // 3. Discordの特殊なフォーマット除去
    filteredText = this.removeDiscordFormatting(filteredText);

    // 4. 連続する空白や改行の正規化
    filteredText = this.normalizeWhitespace(filteredText);

    // 5. 読み上げに適さない文字の除去
    filteredText = this.removeUnreadableCharacters(filteredText);

    return filteredText.trim();
  }

  /**
   * URL/URIの除去（より包括的）
   */
  private static removeUrls(text: string): string {
    // HTTP/HTTPS URL
    text = text.replace(/https?:\/\/\S+/gi, '');
    
    // FTP URL
    text = text.replace(/ftp:\/\/\S+/gi, '');
    
    // メールアドレス風のURI
    text = text.replace(/mailto:\S+/gi, '');
    
    // Discord関連のURI
    text = text.replace(/discord(?:\.gg|app\.com)\/\S+/gi, '');
    
    // 一般的なドメイン形式（www.example.com など）
    text = text.replace(/(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?/g, '');
    
    // IPv4アドレス
    text = text.replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?(?:\/\S*)?\b/g, '');
    
    // ファイルパス（Windows/Linux形式）
    text = text.replace(/(?:[A-Za-z]:)?(?:[\\\/][^\\\/\s]+)+[\\\/]?/g, '');

    return text;
  }

  /**
   * 絵文字の処理
   */
  private static processEmojis(text: string): string {
    const emoji = emojiRegex();
    const customEmoji = /<a?:\w+:\d+>/g;

    // Unicode絵文字を除去
    text = text.replace(emoji, '');
    
    // Discordカスタム絵文字を除去
    text = text.replace(customEmoji, '');

    return text;
  }

  /**
   * Discordの特殊なフォーマットの除去
   */
  private static removeDiscordFormatting(text: string): string {
    // メンション (@user, @role, #channel)
    text = text.replace(/<[@#&!]\d+>/g, 'メンション');
    
    // 太字、斜体、取り消し線などのMarkdown記法
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');  // 太字
    text = text.replace(/\*(.*?)\*/g, '$1');      // 斜体
    text = text.replace(/__(.*?)__/g, '$1');      // 下線
    text = text.replace(/~~(.*?)~~/g, '$1');      // 取り消し線
    text = text.replace(/`(.*?)`/g, '$1');        // インラインコード
    
    // コードブロック
    text = text.replace(/```[\s\S]*?```/g, 'コード');
    
    // 引用
    text = text.replace(/^>\s*/gm, '');

    return text;
  }

  /**
   * 連続する空白や改行の正規化
   */
  private static normalizeWhitespace(text: string): string {
    // 連続する空白を単一の空白に
    text = text.replace(/\s+/g, ' ');
    
    // 連続する改行を削除
    text = text.replace(/\n+/g, ' ');

    return text;
  }

  /**
   * 読み上げに適さない文字の除去
   */
  private static removeUnreadableCharacters(text: string): string {
    // 特殊記号の除去（一部の記号は残す）
    text = text.replace(/[^\w\s\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF！？。、]/g, '');
    
    // ID文字列やハッシュの除去（長い英数字の羅列）
    text = text.replace(/\b[a-zA-Z0-9]{20,}\b/g, '');
    
    // 数字のみの長い文字列の除去（IDなど）
    text = text.replace(/\b\d{10,}\b/g, '');

    return text;
  }

  /**
   * テキストが読み上げに値するかどうかをチェック
   */
  static isWorthReading(text: string): boolean {
    const filteredText = this.filterForSpeech(text);
    
    // 空白のみまたは短すぎる場合は読み上げない
    if (filteredText.length < 2) {
      return false;
    }
    
    // 記号のみの場合は読み上げない
    if (/^[^\w\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]+$/.test(filteredText)) {
      return false;
    }

    return true;
  }
}
