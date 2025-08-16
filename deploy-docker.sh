cd /home/tsubasa/git-repositories/voicevox_bot/

forever docker compose stop

git pull

forever docker compose up -d
