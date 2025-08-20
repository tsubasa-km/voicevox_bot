import express, { Request, Response } from 'express';

const app = express();

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});

interface ApiParams {
    guildId: string;
    userId: string;
    settingName: string;
}

app.get('/api/:guildId/:userId/:settingName', (req: Request<ApiParams>, res: Response) => {
    res.send(`Guild ID: ${req.params.guildId}, User ID: ${req.params.userId}, Setting Name: ${req.params.settingName}`);
});
