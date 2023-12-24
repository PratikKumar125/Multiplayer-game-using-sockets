const express = require("express");
const socket = require("socket.io");
const redis = require("redis");
const app = express();
const httpServer = require("http").createServer(app);
const redis_client = redis.createClient(6379);
redis_client.connect();
const PORT = 9001;
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
      io.to(user1.socketId)
        .to(user2.socketId)
        .emit("joinRoom", { room: `${GAMEID}-GAME-1` });

      //Match done
      io.to(user1.socketId)
        .to(user2.socketId)
        .emit("match:done", { user1, user2 });
    } else {
      socket.emit("match:waiting", {
        message: "We are connecting you with your game partner",
      });
    }
  });

  socket.on("joinRoom", async (data) => {
    await redis_client.set(`${data.token}-ROOM`, data.roomName);
    console.log(
      `${data.token}-ROOM`,
      await redis_client.get(`${data.token}-ROOM`),
      typeof (await redis_client.get(`${data.token}-ROOM`))
    );
    await redis_client.set(
      `${data.roomName}-USER-${data.token}`,
      JSON.stringify({ ...data, socketId: socket.id })
    );
    socket.join(data.roomName);
    socket.leave(`${GAMEID}-LOBBY`);
    await redis_client.set(`${data.roomName}-ANSWER`, 0);
  });

  socket.on("userPick", async (data) => {
    //push his pick to his redis key and then find his room and emit the result there
    const userRoom = await redis_client.get(`${data.token}-ROOM`);
    let user = await redis_client.get(`${userRoom}-USER-${data.token}`);
    user = JSON.parse(user);
    console.log(typeof user, user.name, "<<<=====USER");
    typeof user === String ? JSON.parse(user) : "";
    const newUser = { ...user, choice: data.answer };
    await redis_client.set(
      `${data.roomName}-USER-${data.token}`,
      JSON.stringify(newUser)
    );
    //
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening at port ${PORT}`);
});

httpServer.on("error", (error) => {
  console.error("Server error:", error.message);
});
