FROM node:22-bullseye
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install -g npm && npm install

COPY . .

RUN npm run build

EXPOSE ${PORT}

CMD ["npm", "run", "start:deploy"]
