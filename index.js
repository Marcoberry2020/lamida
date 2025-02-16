const express = require("express");
const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");
const twilio = require("twilio");
const cors = require("cors");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Store chat ID to identify user input
const userCalls = new Map();

bot.onText(/\/call (.+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1];
    const message = match[2];

    try {
        const twimlUrl = `${process.env.SERVER_URL}/voice?chatId=${chatId}&message=${encodeURIComponent(message)}`;

        const call = await client.calls.create({
            url: twimlUrl,
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
        });

        userCalls.set(call.sid, chatId);

        bot.sendMessage(chatId, `Calling ${phoneNumber}...`);
    } catch (error) {
        bot.sendMessage(chatId, `Failed to call ${phoneNumber}: ${error.message}`);
    }
});

// Twilio Voice Response
app.post("/voice", (req, res) => {
    const { chatId, message } = req.query;
    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say(message, { voice: "alice" });

    twiml.gather({
        numDigits: 1,
        action: `${process.env.SERVER_URL}/dtmf?chatId=${chatId}`,
        method: "POST",
    });

    res.type("text/xml").send(twiml.toString());
});

// Handle DTMF input
app.post("/dtmf", (req, res) => {
    const chatId = req.query.chatId;
    const digits = req.body.Digits;

    if (chatId) {
        bot.sendMessage(chatId, `User pressed: ${digits}`);
    }

    res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Telegram VoIP Bot is running!"));

app.listen(5000, () => console.log("Server running on port 5000"));
