import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { INITIAL_GURU } from "./src/constants";

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "data.json");

// Initial state
let state = {
  bookings: [],
  blocks: [],
  teachers: INITIAL_GURU
};

// Load state from file if exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(saved);
    // Merge with initial state to ensure structure
    state = { ...state, ...parsed };
    console.log("Data loaded successfully from", DATA_FILE);
  } catch (e) {
    console.error("Failed to load data:", e);
  }
} else {
  console.log("No data file found, starting with initial state.");
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    console.log("Data saved to", DATA_FILE);
  } catch (e) {
    console.error("Failed to save data:", e);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Broadcast to all clients
  function broadcast(data: any, sender?: WebSocket) {
    const message = JSON.stringify(data);
    let count = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== sender) {
        client.send(message);
        count++;
      }
    });
    console.log(`Broadcasted ${data.type} to ${count} clients`);
  }

  wss.on("connection", (ws) => {
    console.log("New client connected. Total clients:", wss.clients.size);
    
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("Received message:", message.type);
        
        switch (message.type) {
          case "GET_INIT":
            ws.send(JSON.stringify({ type: "INIT", payload: state }));
            break;
          case "UPDATE_BOOKINGS":
            state.bookings = message.payload;
            saveState();
            broadcast(message, ws);
            break;
          case "UPDATE_BLOCKS":
            state.blocks = message.payload;
            saveState();
            broadcast(message, ws);
            break;
          case "UPDATE_TEACHERS":
            state.teachers = message.payload;
            saveState();
            broadcast(message, ws);
            break;
        }
      } catch (e) {
        console.error("Failed to process message:", e);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected. Remaining clients:", wss.clients.size);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
