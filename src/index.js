const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const { generateMessage, generateLocationMessage } = require("./utils/messages");
const { addUser, removeUser, getUser, getUsersInRoom } = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

require("dotenv").config();

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on("connection", socket => {
  console.log("New WebSocket connection");

  // socket.on("join", (options, callback) => {
  //   console.log("Join");
    
  //   const { error, user } = addUser({ id: socket.id, ...options });
  //   if (error) {
  //     return callback(error);
  //   } else {
  //     socket.join(user.room);

  //     socket.emit("message", generateMessage("Admin", "Welcome!"));
  //     socket.broadcast.to(user.room).emit("message", generateMessage("Admin", `${user.username} has joined!`));
  //     io.to(user.room).emit("roomData", {
  //       room: user.room,
  //       users: getUsersInRoom(user.room)
  //     });

  //     callback();
  //   }
  // });
  socket.on("join", (options, callback) => {
    console.log("Join");
    
    // const { latitude, longitude } = options;
    const latitude = 60.0;
    const longitude = 18.0;
    
    const isInSweden =
    latitude >= 55.3 && latitude <= 69.1 &&
    longitude >= 11.1 && longitude <= 24.2;
    
    if (!isInSweden) {
    console.log("User not in sweden：lat=" + latitude + ", lon=" + longitude);
    return callback("You are not in Sweden cannot access the chat！");
    }
    
    const { error, user } = addUser({ id: socket.id, ...options });
    
    if (error) {
    return callback(error);
    }
    
    socket.join(user.room);
    
    socket.emit("message", generateMessage("Admin", "Welcome!"));
    socket.broadcast.to(user.room).emit("message", generateMessage("Admin", `${user.username} has joined!`));
    io.to(user.room).emit("roomData", {
    room: user.room,
    users: getUsersInRoom(user.room)
    });
    
    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    console.log("Send message");
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed!");
    } 
    else if(message.includes("NULL")){
      return callback("NULL is not allowed!");
    }else {
      io.to(user.room).emit("message", generateMessage(user.username, message));
      callback();
    }
  });

  socket.on("sendLocation", (coords, callback) => {
    console.log("Send location");

    const user = getUser(socket.id);
    const { latitude, longitude } = coords;
    
    const withinLatitudeRange = latitude >= 18 && latitude <= 54;
    const withinLongitudeRange = longitude >= 73 && longitude <= 135;
    
    if (withinLatitudeRange && withinLongitudeRange) {
    console.log(`${user.username} is within target location China: lat=${latitude}, long=${longitude}`);
    } else {
      console.log(`${user.username} is NOT within target location China: lat=${latitude}, long=${longitude}`);
    }
    
    io.to(user.room).emit("locationMessage", generateLocationMessage(user.username, `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`));

    callback();
  });
  

  socket.on("disconnect", () => {
    console.log("Disconnect");
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", generateMessage("Admin", `${user.username} has left!`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
