import "dotenv/config";
import express from "express";
import bcrypt from "bcrypt";
import { JWT_SECRET } from "@repo/backend-common/config";
import { verifyUser } from "./middleware.js";
import {
  CreateRoomSchema as RoomSchema,
  SignInSchema,
  userSchema,
} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import jwt from "jsonwebtoken";
import cors from "cors";
import cookieParser from "cookie-parser";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND,
    credentials: true,
  }),
);
app.use(cookieParser());

app.post("/signup", async (req, res) => {
  const parsedData = userSchema.safeParse(req.body);
  if (!parsedData.success)
    return res.status(404).json({ message: "Incorrect credentials" });
  const { username, email, password } = parsedData.data;
  try {
    const alreadyPresent = await prismaClient.user.findUnique({
      where: { email },
    });
    if (alreadyPresent)
      return res
        .status(404)
        .json({ message: "Email already connected to another account" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prismaClient.user.create({
      data: {
        email,
        name: username,
        password: hashed,
      },
    });
    const token = jwt.sign({ id: user?.id }, JWT_SECRET);
    // res.cookie("token", token, {
    //   maxAge: 3 * 24 * 60 * 60 * 1000,
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "none",
    // });
    //console.log("yha cookie", res.cookie);
    return res.json({ message: "Registered successfully",token });
  } catch (error) {
    console.log("inside sign up catch",error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/signin", async (req, res) => {
  const parsedData = SignInSchema.safeParse(req.body);
  if (!parsedData.success)
    return res.status(404).json({ message: "Incorrect credentials" });
  const { email, password } = parsedData.data;
  try {
    const user = await prismaClient.user.findUnique({
      where: { email },
    });
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found. Please signup first." });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(404).json({ message: "Wrong Credentials" });
    const token = jwt.sign({ id: user?.id }, JWT_SECRET);
    // res.cookie("token", token, {
    //   maxAge: 3 * 24 * 60 * 60 * 1000,
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "none",
    // });
    console.log('line 98');
    return res.json({ message: "Logged-In successfully",token });
  } catch (error) {
    console.error("SIGNIN ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/logout", async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    return res.json({ message: "Logged Out successfully." });
  } catch (error) {
    return res.status(500).json({ message: "bug in /logout endpt" });
  }
});

app.get("/room", verifyUser, async (req, res) => {//to get the rooms
  console.log("getting rooms");
  try {
    console.log("101");
    const userId = req.userId;
    const rooms = await prismaClient.room.findMany({
      where: {
        adminId: userId,
      },
    });
    console.log(rooms);
    console.log("108");
    return res.json({ rooms });
  } catch (error) {
    console.log("inside room catch",error);
    return res.status(500).json({ message: "bug in /room get endpt" });
  }
});

app.post("/room", verifyUser, async (req, res) => {//to create a room
  try {
    console.log("room hit");
    const parsedData = RoomSchema.safeParse(req.body);
    if (!parsedData.success)
      return res.status(400).json({ message: "Incorrect credentials" });
    const userId = req.userId;
    console.log(userId);
    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        admin: { connect: { id: userId } },
      },
    });
    console.log("created");
    return res.json({ room, message: "Room created Successfully." });
  } catch (error) {
    return res.status(500).json({ message: "bug in /room post endpt" });
  }
});

app.delete("/chats/:roomId",async(req,res) => {//to delete messages
  console.log('deleting all shapes');
  const roomId = req.params.roomId;
  await prismaClient.chat.deleteMany({
    where:{
      roomId
    }
  });
  return res.json({message:"Canvas reset"});
})

app.get("/room/:slug", async (req, res) => {//returning roomId
  const slug = req.params.slug;
  const room = await prismaClient.room.findFirst({
    where: {
      slug,
    },
  });
  return res.json({ room });
});

app.use("/", (req, res) => {
  res.send("Working");
});

app.listen(3001, () => {
  console.log(`Server started 3001`);
});
