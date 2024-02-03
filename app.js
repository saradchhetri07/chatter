// package imports
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const moment = require("moment");
const http = require("http");
const socket = require("socket.io");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const cookie = require("cookie-parser");
require("dotenv").config();
const port = process.env.PORT || 3000;
const mongodbUri = process.env.MONGODB_URI;

// user imports
const formatMessage = require("./utils/messages");
const { urlencoded } = require("express");
const messages = require(path.join(__dirname, "utils", "messages"));
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require(path.join(
  __dirname,
  "utils",
  "users"
));
const Chat = require("./models/Chat");
const authroutes = require("./routes/auth");
const serviceroutes = require("./routes/service");
const confUtils = require("./config/authenticate");
//connectiong mongooose
require("./config/passport")(passport);

const app = express();
const server = http.createServer(app);
const io = socket(server);
const bot = "ChatBox Bot";

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(cookie("th3_ma3stro"));
app.use(
  session({
    secret: "th3_ma3stro",
    resave: true,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use("", authroutes);
app.use("", serviceroutes);

app.get("/", (req, res) => {
  res.redirect("/login");
});
//mongodb://127.0.0.1:27017/chatterDB"

mongoose.connect(
  "mongodb+srv://saradchhetri20690:Lu77pa@7882@cluster0.tfmjtz7.mongodb.net/",
  { useUnifiedTopology: true, useNewUrlParser: true },
  (err, database) => {
    if (err) {
      throw err;
    }

    console.log("Connected....");

    io.on("connection", (socket) => {
      socket.on("joinRoom", ({ username, room, roomid }) => {
        const user = userJoin(socket.id, username, room);

        //Join room
        socket.join(user.room); //changed

        // Get and send chats stored in mongo collection
        Chat.find({ room: roomid })
          .limit(100)
          .sort({ _id: 1 })
          .then((messages) => {
            socket.emit("prev_messages", messages);
          })
          .catch((err) => {
            throw err;
          });
      });

      //Listens for user messages
      socket.on("chatMsg", ({ msg, roomid }) => {
        const user = getCurrentUser(socket.id);
        const newMsg = new Chat({
          room: roomid,
          name: user.username,
          message: msg,
          time: moment().format("h:mm a"),
        })
          .save()
          .then((resp) => {
            io.to(user.room).emit("message", formatMessage(user.username, msg));
          });
      });

      //Listens for typing
      socket.on("typing", ({ username, room }) => {
        socket.broadcast
          .to(room)
          .emit("typing_display", { username, message: "typing" });
      });

      socket.on("typing_remove", (room) => {
        const user = getCurrentUser(socket.id);
        socket.broadcast
          .to(room)
          .emit("typing_display", { username: user.username, message: "" });
      });

      // Listens for disconnections
      socket.on("disconnect", () => {
        const user = userLeave(socket.id);
        if (user) {
          io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: getRoomUsers(user.room),
          });
        }
      });
    });
  }
);

app.use(confUtils.ensureAuthenticated, (req, res, next) => {
  res.render("404", { user: req.user });
});

server.listen(port, () => {
  console.log(`Server started on port 3000`);
});

app.get("/logout", function (req, res) {
  console.log("logout");
  req.logout(function (err) {
    if (!err) {
      res.redirect("/");
    } else {
      console.log(err);
    }
  });
});
