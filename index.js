require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.API_KEY;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
});

const POLITICAL_RESPONSE = "This chatbot is not for political questions.";
const BUSINESS_SYSTEM_PROMPT = `
You are a helpful sales assistant for a digital service business.
The business sells websites, UI/UX design, landing pages, web redesign, and related digital services.

Business owner:
- Name: Sojib
- Phone: 01706881718
- Address: Rangpur

Your job:
- Understand the user's question, intent, and business problem automatically, even if they ask in different ways.
- Do not use fixed or canned answers. Create a fresh answer based on the user's exact message and conversation history.
- Always reply in English, even if the user writes in Bangla, Banglish, or another language.
- Ask 1-3 useful follow-up questions when the user's need is unclear.
- Suggest the right service based on the user's problem, such as website development, UI/UX design, landing page, ecommerce website, portfolio website, business website, or redesign.
- Explain benefits in simple, friendly language connected to the user's situation.
- Keep replies short and practical.
- If the user seems interested in buying or contacting, share Sojib's phone number and Rangpur address.
- Do not make fake prices, timelines, discounts, or guarantees unless the user provides them.
- If the question is unrelated to digital services, answer briefly if helpful, then guide back to website/UI/UX services.
- If the user only says a vague line like "I need a website", ask what type of business, goal, needed pages/features, and whether they want design or full development.
`.trim();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Express!");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
  });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, messages } = req.body;

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY is missing",
        details: "Add OPENROUTER_API_KEY=your_key_here in .env",
      });
    }

    const chatMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : [{ role: "user", content: message }];

    if (!message && (!Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({
        error: "Message is required",
        details: "Send either message or messages in the request body",
      });
    }

    const userText =
      Array.isArray(messages) && messages.length > 0
        ? messages
            .filter((chatMessage) => chatMessage.role === "user")
            .map((chatMessage) => chatMessage.content)
            .join(" ")
        : message || "";

    const classification = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Classify whether the user's message is a political question. Political means asking about elections, voting, politicians, parties, governments, political opinions, campaigns, policies, or political persuasion. Reply with exactly one word: political or non_political.",
        },
        {
          role: "user",
          content: userText,
        },
      ],
      temperature: 0,
    });

    const label = classification.choices[0].message.content
      .trim()
      .toLowerCase();

    if (label === "political") {
      return res.json({
        reply: POLITICAL_RESPONSE,
      });
    }

    const businessMessages = [
      {
        role: "system",
        content: BUSINESS_SYSTEM_PROMPT,
      },
      ...chatMessages,
    ];

    const apiResponse = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: businessMessages,
      reasoning: { enabled: true },
    });

    const response = apiResponse.choices[0].message;

    res.json({
      reply: response.content,
    });
  } catch (error) {
    console.error("OpenRouter API error:", error.message);

    res.status(500).json({
      error: "Failed to generate reply",
      details: error.message,
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
