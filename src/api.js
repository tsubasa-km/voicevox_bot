import express from 'express';

const app = express();

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});


app.get('/api/:guildId/:userId/:settingName', (req, res) => {
    res.send(`Guild ID: ${req.params.guildId}, User ID: ${req.params.userId}, Setting Name: ${req.params.settingName}`);
});
