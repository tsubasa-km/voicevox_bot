cd /home/tsubasa/git-repositories/voicevox_bot/

forever stop ./

git pull

npm install

forever start -c "npm start" ./

