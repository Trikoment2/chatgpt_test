require('dotenv').config()
const { Configuration, OpenAIApi } = require("openai");
const { getImage, getChat } = require("./Helper/functions");
const { Telegraf } = require("telegraf");

const { MongoClient } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db;

mongoClient.connect((err, client) => {
  if (err) {
    console.log(err);
    return;
  }
  db = client.db();
  console.log("Connected to MongoDB");
});

const configuration = new Configuration({
  apiKey: process.env.API,
});
const openai = new OpenAIApi(configuration);
module.exports = openai;

const bot = new Telegraf(process.env.TG_API);

bot.use((ctx, next) => {
  if (db && ctx.chat && ctx.chat.id) {
    const collection = db.collection("users");
    collection.findOne({ chatId: ctx.chat.id }, (err, result) => {
      if (err) {
        console.log(err);
        return next();
      }
      if (result) {
        ctx.dbuser = result;
        return next();
      }
      collection.insertOne({ chatId: ctx.chat.id }, (err, result) => {
        if (err) {
          console.log(err);
          return next();
        }
        ctx.dbuser = result.ops[0];
        console.log("User added to MongoDB");
        next();
      });
    });
  } else {
    next();
  }
});

bot.start((ctx) => ctx.reply("Welcome , You can ask anything from me"));

bot.help((ctx) => {
  ctx.reply(
    "This bot can perform the following command \n /image -> to create image from text \n /ask -> ask anything from me "
  );
});

bot.command("image", async (ctx) => {
  const text = ctx.message.text?.replace("/image", "")?.trim().toLowerCase();

  if (text) {
    const res = await getImage(text);

    if (res) {
      ctx.sendChatAction("upload_photo");
      ctx.telegram.sendPhoto(ctx.message.chat.id, res, {
        reply_to_message_id: ctx.message.message_id,
      });
    }
  } else {
    ctx.telegram.sendMessage(
      ctx.message.chat.id,
      "You have to give some description after /image",
      {
        reply_to_message_id: ctx.message.message_id,
      }
    );
  }
});

bot.on('message', async (ctx) => {
  const messageText = ctx.message.text;

  if (messageText) {
    ctx.sendChatAction("typing");
    const res = await getChat(messageText);
    if (res) {
      ctx.telegram.sendMessage(ctx.message.chat.id, res);
    }
  }
});

bot.launch();
