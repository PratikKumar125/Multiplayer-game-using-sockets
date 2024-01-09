const express = require("express");
const socket = require("socket.io");
const redis = require("redis");
const app = express();
const httpServer = require("http").createServer(app);
// const redis_client = redis.createClient({
//   legacyMode: true,
//   socket: {
//     host: process.env.REDIS_HOST || "172.17.0.1",
//     port: process.env.REDIS_PORT || 6379,
//   },
// });
const redis_client = redis.createClient(6379);
redis_client.connect();
const PORT = process.env.PORT ? process.env.PORT : 9001;
const GAMEID = "GAME127127";

redis_client.on("error", (err) => {
  console.log(err);
});
const io = new socket.Server(httpServer, {
  cors: {
    origin: "*",
    allowedHeaders: "*",
  },
});

io.on("connection", async (socket) => {
  console.log("New user connected with socket id as", socket.id);
  socket.on("lobby:join", async (userData) => {
    socket.join(`${GAMEID}-LOBBY`);
    await redis_client.rPush(
      `${GAMEID}-LOBBY`,
      JSON.stringify({ ...userData, socketId: socket.id })
    );
    if ((await redis_client.LLEN(`${GAMEID}-LOBBY`)) >= 2) {
      const user1 = JSON.parse(await redis_client.lPop(`${GAMEID}-LOBBY`));
      const user2 = JSON.parse(await redis_client.lPop(`${GAMEID}-LOBBY`));

      //join them to a game room
      // Emit a message to join a room
      const room_name = `${GAMEID}-GAME-1`;
      // store user count in redis
      if (!redis_client.get(`${room_name}-USER-COUNT`)) {
        io.to(user1.socketId).emit("joinRoom", {
          room: room_name,
          choice: "HEADS",
        }); //create random room name
      } else {
        io.to(user1.socketId).emit("joinRoom", {
          room: room_name,
          choice: "TAILS",
        }); //create random room name
      }
      //Match done
      io.to(user1.socketId)
        .to(user2.socketId)
        .emit("match:done", { user1, user2 });
      await redis_client.set(`${room_name}-ANSWER`, "TAILS");
    } else {
      socket.emit("match:waiting", {
        message: "We are connecting you with your game partner",
      });
    }
  });

  socket.on("joinRoom", async (data) => {
    await redis_client.set(
      `${data.token}-ROOM`,
      JSON.stringify({ room: data.roomName, choice: data.choice })
    ); //is user ka room ka naam store kia
    await redis_client.set(
      `${data.roomName}-USER-${data.token}`,
      JSON.stringify({ ...data, socketId: socket.id })
    ); //room ke through user ki details fetch krna
    socket.join(data.roomName);
    socket.leave(`${GAMEID}-LOBBY`);
  });

  socket.on("result", async (data) => {
    console.log(data, "<<<<<<RESULT EVENT DATA PAYLOAD");
    const result = await redis_client.get(`${data.room}-ANSWER`);
    io.to(data?.room).emit("result", {
      result,
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening at port ${PORT}`);
});

httpServer.on("error", (error) => {
  console.error("Server error:", error.message);
});

// adding args, env, volumes, entrypoint in docker compose and practical use-cases

//connect -> lobby -> match -> handle user1 & user2 -> give random choice -> timer -> calculate result
/*
1) show you and other
2) show you won or you loose
3) dynamic room name
*/
