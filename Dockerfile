# Node.js 公式イメージを使用
FROM node:22-slim

# 必要なパッケージをインストール（FFmpegを含む）
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを設定
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install -g npm && npm install --production

# アプリケーションのソースをコピー
COPY . .

# アプリケーションを起動
CMD ["npm", "start"]
