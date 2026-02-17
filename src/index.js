import express from 'express';
import { matchRouter } from './routes/matches.js';
import http from "http";
import {attachWebSocketServer} from "./ws/server.js";

const PORT = (process.env.PORT || 8000);
const HOST = (process.env.HOST || '0.0.0.0')

const app = express();

const server = http.createServer(app);
// Middleware
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Express server!' });
});

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

app.use('/matches', matchRouter)
// Start server
server.listen(PORT, HOST,() => {
  const baseURL = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running ${baseURL}`);
  console.log(`Websocket server is running on ${baseURL.replace('http','ws')}/ws`);
});
