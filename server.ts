import express from "express";
console.log("SERVER.TS STARTING...");
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Stripe from "stripe";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import { Chess } from "chess.js";
import admin from "firebase-admin";
import cors from "cors";
import { spawn } from "child_process";
import http from "http";

dotenv.config();

const engineAgent = new http.Agent({ keepAlive: true });

const resolvedFilename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const resolvedDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(resolvedFilename);

// Initialize Firebase Admin
let db: any = null;

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

try {
  if (!admin.apps.length) {
    let serviceAccount = null;
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } else {
        const localSaPath = path.join(resolvedDirname, "..", "service-account.json");
        const rootSaPath = path.join(resolvedDirname, "service-account.json");
        if (fs.existsSync(localSaPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(localSaPath, "utf-8"));
          console.log("Loaded Firebase credentials from service-account.json (relative parent)");
        } else if (fs.existsSync(rootSaPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(rootSaPath, "utf-8"));
          console.log("Loaded Firebase credentials from service-account.json");
        }
      }
    } catch (parseError) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it is valid JSON.");
    }

    if (serviceAccount) {
      try {
        let databaseId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-87029be7-5ea0-46e5-96aa-66354f59b7db";
        
        const configPath = path.join(resolvedDirname, "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          try {
            const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            if (fileConfig.firestoreDatabaseId && fileConfig.firestoreDatabaseId !== 'YOUR_FIRESTORE_DB_ID') {
              databaseId = fileConfig.firestoreDatabaseId;
            }
          } catch (err) {
            console.error("Failed to parse firebase-applet-config.json:", err);
          }
        }
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        });
        
        db = admin.firestore(databaseId);
        console.log(`Firebase Admin initialized with database: ${databaseId}`);
      } catch (initError) {
        console.error("Firebase Admin initializeApp failed:", initError);
      }
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT not found or invalid. Firebase Admin features will be limited.");
    }
  } else {
    db = admin.firestore();
  }
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Re-enabled with reasonable limit
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later"
});

let stripeInstance: Stripe | null = null;

function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

async function startServer() {
  console.log("startServer() called. NODE_ENV:", process.env.NODE_ENV);
  try {
    const app = express();
    // Trust the first proxy (e.g., Nginx, Cloud Run) to correctly identify client IPs
    app.set('trust proxy', 1);
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
  
  // Enable CORS
  app.use(cors());

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.stripe.com", "https://*.google.com"],
        connectSrc: ["'self'", "*", "wss://*.run.app", "wss://*.google.com", "https://*.stripe.com"],
        frameAncestors: ["'self'", "https://aistudio.google.com", "https://*.google.com", "https://*.run.app"],
        frameSrc: ["'self'", "https://checkout.stripe.com", "https://*.google.com"],
        imgSrc: ["*", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  }));

  // Apply rate limiter
  app.use("/api/", limiter);

  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Stripe Webhook (MUST be before express.json)
  app.post("/api/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      const stripe = getStripe();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn("STRIPE_WEBHOOK_SECRET is missing. Webhook validation skipped.");
        return res.status(400).send("Webhook Error: Missing secret");
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook Error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId && db) {
        await db.collection('users').doc(userId).update({
          isPremium: true,
          premiumUntil: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // 30 days
        });
        console.log(`User ${userId} upgraded to premium`);
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // Engine Proxy (Module 1.1)
  app.post("/api/engine/move", async (req, res) => {
    try {
      // High-performance proxy
      const response = await fetch("http://localhost:3001/api/engine/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Rust Backend Unreachable:", error);
      res.status(503).json({ 
        error: "Chess Engine currently offline",
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });

  // Root health and version check
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/version", (req, res) => {
    res.json({ version: process.env.VITE_APP_VERSION || "1.0.0" });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    console.log("Health check requested. NODE_ENV:", process.env.NODE_ENV);
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  // Narration endpoint to prevent frontend API key leakage
  app.post("/api/narration", async (req, res) => {
    const { text, lang } = req.body;
    if (!text || !lang) {
      return res.status(400).json({ error: "Missing text or lang" });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ GEMINI_API_KEY is not defined. GenAI narration will be unavailable.");
      return res.status(503).json({ error: "Gemini API key not configured on server" });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const genAIClient = new GoogleGenAI({ apiKey });

      let textToNarrate = text;
      const LANGUAGE_LABELS: Record<string, string> = {
        en: 'English',
        hi: 'Hindi (हिंदी)',
        ar: 'Arabic (العربية)'
      };

      // Step 1: Translate if not English
      if (lang !== 'en') {
        const targetLangLabel = LANGUAGE_LABELS[lang] || lang;
        const translationPrompt = `You are a professional chess coach. Translate the following chess lesson text into ${targetLangLabel}. You must translate every single detail, including the title, description, and every rule completely. Do not summarize, shorten, or omit any details. Make sure to translate the word 'Rules:' or 'Rules' to the native word ('नियम:' for Hindi, 'القواعد:' for Arabic). Do not output the word 'Rules' in English. Output ONLY the raw translated text in ${targetLangLabel} script. Translate and narrate the content in the selected language only. Do not return English unless selected language is English. No explanations, no introductory phrases, no formatting, and no English text.
Text to translate: "${text}"`;
        const result = await genAIClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: 'user', parts: [{ text: translationPrompt }] }]
        });
        textToNarrate = (result.text || "").trim() || text;
      }

      // Step 2: Narrate using Google Translate TTS API for native fluency and no API key limits
      // Split text into chunks under 180 chars to respect Google Translate TTS limit
      const splitTextIntoChunks = (str: string, maxLen: number = 180): string[] => {
        const sentences = str.match(/[^.!?]+[.!?]*/g) || [str];
        const chunks: string[] = [];
        let currentChunk = "";

        for (let sentence of sentences) {
          sentence = sentence.trim();
          if (!sentence) continue;

          if (currentChunk.length + sentence.length + 1 <= maxLen) {
            currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            if (sentence.length > maxLen) {
              const subSentences = sentence.split(/[,;]/);
              for (let sub of subSentences) {
                sub = sub.trim();
                if (!sub) continue;
                if (sub.length <= maxLen) {
                  chunks.push(sub);
                } else {
                  const words = sub.split(' ');
                  let wordChunk = "";
                  for (const word of words) {
                    if (wordChunk.length + word.length + 1 <= maxLen) {
                      wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
                    } else {
                      if (wordChunk) chunks.push(wordChunk);
                      wordChunk = word;
                    }
                  }
                  if (wordChunk) chunks.push(wordChunk);
                }
              }
            } else {
              currentChunk = sentence;
            }
          }
        }
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        return chunks;
      };

      const chunks = splitTextIntoChunks(textToNarrate, 180);
      const audioBuffers: Buffer[] = [];

      for (const chunk of chunks) {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;
        const ttsRes = await fetch(ttsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (!ttsRes.ok) {
          throw new Error(`Google Translate TTS failed with status ${ttsRes.status}`);
        }
        const arrayBuffer = await ttsRes.arrayBuffer();
        audioBuffers.push(Buffer.from(arrayBuffer));
      }

      const combinedBuffer = Buffer.concat(audioBuffers);
      const base64Audio = combinedBuffer.toString('base64');
      
      return res.json({ 
        audio: base64Audio, 
        translatedText: textToNarrate,
        mimeType: 'audio/mpeg',
        format: 'mp3'
      });
    } catch (err: any) {
      console.error("Server narration generation failed:", err);
      return res.status(500).json({ error: "Narration failed", details: err.message });
    }
  });

  // Session Token Endpoint
  app.post("/api/auth/session-token", async (req, res) => {
    const { idToken, guest, guestUid } = req.body;
    try {
      let uid: string;
      
      if (guest) {
        if (!guestUid) {
          return res.status(400).json({ error: "Missing guestUid" });
        }
        uid = guestUid.startsWith("guest_") ? guestUid : `guest_${guestUid}`;
      } else {
        if (!idToken) {
          return res.status(400).json({ error: "Missing ID token" });
        }
        
        const isProduction = process.env.NODE_ENV === "production";
        const hasAdmin = admin.apps.length > 0 && db !== null;

        if (!hasAdmin) {
          if (!isProduction) {
            // Dev Mock Auth
            uid = idToken; // in dev, we can use the idToken directly as mock uid
          } else {
            return res.status(500).json({ error: "Firebase Admin is not initialized" });
          }
        } else {
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          uid = decodedToken.uid;
        }
      }

      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins validity
      const secret = process.env.SESSION_TOKEN_SECRET || "default_session_secret";
      
      const crypto = await import("crypto");
      const dataToSign = `${uid}:${expiresAt}`;
      const signature = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");
      const sessionToken = `${dataToSign}:${signature}`;

      res.json({ token: sessionToken, uid });
    } catch (err: any) {
      console.error("Failed to verify Firebase ID token:", err);
      res.status(401).json({ error: "Invalid Firebase ID token" });
    }
  });

  // API routes
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { userId, userEmail } = req.body;
      const stripe = getStripe();
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Clash of Crowns Premium",
                description: "Unlock all premium features including AI analysis and video replays.",
              },
              unit_amount: 999, // $9.99
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/?payment=cancel`,
        customer_email: userEmail,
        metadata: {
          userId,
        },
      });

      res.json({ id: session.id });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify and Apply Ranked Results
  app.post("/api/ranked/verify-and-apply", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    
    const hasAdmin = admin.apps.length > 0 && db !== null;
    let callerUid: string;
    try {
      const isProduction = process.env.NODE_ENV === "production";
      if (!hasAdmin) {
        if (!isProduction) {
          callerUid = idToken; // dev mock
        } else {
          return res.status(500).json({ error: "Firebase Admin is not initialized" });
        }
      } else {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        callerUid = decodedToken.uid;
      }
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const {
      roomId,
      rankedMatchId,
      whiteUid,
      blackUid,
      result,
      reason,
      moveCount,
      timestamp,
      verificationHash,
    } = req.body;

    if (!roomId || !rankedMatchId || !whiteUid || !blackUid || !result || !reason || moveCount === undefined || !timestamp || !verificationHash) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (callerUid !== whiteUid && callerUid !== blackUid) {
      return res.status(403).json({ error: "Caller is not a participant in this match" });
    }

    // Verify HMAC signature
    const crypto = await import("crypto");
    const payload = `${rankedMatchId}:${whiteUid}:${blackUid}:${result}:${moveCount}:${timestamp}`;
    const secret = process.env.RANKED_RESULT_HMAC_SECRET || "default_ranked_secret";
    const expectedHash = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (expectedHash !== verificationHash) {
      console.warn("HMAC verification failed for match:", rankedMatchId);
      return res.status(400).json({ error: "Invalid result signature" });
    }

    if (!hasAdmin) {
      return res.json({ success: true, message: "Result verified successfully (Dev Mock)" });
    }

    try {
      const matchAppliedRef = db.collection("appliedRankedMatches").doc(rankedMatchId);
      const matchAppliedSnap = await matchAppliedRef.get();
      if (matchAppliedSnap.exists) {
        return res.status(400).json({ error: "Match result already applied" });
      }

      const K = 32;
      const whiteUserRef = db.collection("users").doc(whiteUid);
      const blackUserRef = db.collection("users").doc(blackUid);

      const [whiteDoc, blackDoc] = await Promise.all([whiteUserRef.get(), blackUserRef.get()]);
      if (!whiteDoc.exists || !blackDoc.exists) {
        return res.status(404).json({ error: "One or both users not found" });
      }

      const whiteData = whiteDoc.data();
      const blackData = blackDoc.data();

      const r1 = whiteData.arenaRating ?? 1200;
      const r2 = blackData.arenaRating ?? 1200;

      const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
      const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));

      let s1 = 0.5, s2 = 0.5;
      if (result === "white_win") {
        s1 = 1;
        s2 = 0;
      } else if (result === "black_win") {
        s1 = 0;
        s2 = 1;
      }

      const delta1 = Math.round(K * (s1 - e1));
      const delta2 = Math.round(K * (s2 - e2));

      let newR1 = Math.max(100, r1 + delta1);
      let newR2 = Math.max(100, r2 + delta2);

      await db.runTransaction(async (transaction: any) => {
        transaction.set(matchAppliedRef, {
          appliedAt: admin.firestore.FieldValue.serverTimestamp(),
          whiteUid,
          blackUid,
          result,
          moveCount,
        });

        const whiteHistory = whiteData.multiplayerHistory || [];
        whiteHistory.push({
          roomId,
          opponentUid: blackUid,
          opponentName: blackData.name || "Opponent",
          result: result === "white_win" ? "win" : result === "black_win" ? "loss" : "draw",
          reason,
          playedAt: timestamp,
          moves: moveCount,
        });
        transaction.update(whiteUserRef, {
          arenaRating: newR1,
          appliedArenaResultIds: admin.firestore.FieldValue.arrayUnion(rankedMatchId),
          multiplayerHistory: whiteHistory,
        });

        const blackHistory = blackData.multiplayerHistory || [];
        blackHistory.push({
          roomId,
          opponentUid: whiteUid,
          opponentName: whiteData.name || "Opponent",
          result: result === "black_win" ? "win" : result === "white_win" ? "loss" : "draw",
          reason,
          playedAt: timestamp,
          moves: moveCount,
        });
        transaction.update(blackUserRef, {
          arenaRating: newR2,
          appliedArenaResultIds: admin.firestore.FieldValue.arrayUnion(rankedMatchId),
          multiplayerHistory: blackHistory,
        });

        const whiteEntryRef = db.collection("leaderboards").doc("arena_kings").collection("entries").doc(whiteUid);
        transaction.set(whiteEntryRef, {
          uid: whiteUid,
          displayName: whiteData.name || "Champion",
          avatarUrl: whiteData.photoURL || null,
          mode: "arena_kings",
          score: newR1,
          updatedAt: timestamp,
          arenaStats: {
            arenaRating: newR1,
            arenaWins: (whiteData.arenaWins || 0) + (result === "white_win" ? 1 : 0),
            arenaLosses: (whiteData.arenaLosses || 0) + (result === "black_win" ? 1 : 0),
            arenaDraws: (whiteData.arenaDraws || 0) + (result === "draw" ? 1 : 0),
            arenaMatches: (whiteData.arenaMatches || 0) + 1,
          }
        });

        const blackEntryRef = db.collection("leaderboards").doc("arena_kings").collection("entries").doc(blackUid);
        transaction.set(blackEntryRef, {
          uid: blackUid,
          displayName: blackData.name || "Champion",
          avatarUrl: blackData.photoURL || null,
          mode: "arena_kings",
          score: newR2,
          updatedAt: timestamp,
          arenaStats: {
            arenaRating: newR2,
            arenaWins: (blackData.arenaWins || 0) + (result === "black_win" ? 1 : 0),
            arenaLosses: (blackData.arenaLosses || 0) + (result === "white_win" ? 1 : 0),
            arenaDraws: (blackData.arenaDraws || 0) + (result === "draw" ? 1 : 0),
            arenaMatches: (blackData.arenaMatches || 0) + 1,
          }
        });
      });

      res.json({
        success: true,
        newRating: callerUid === whiteUid ? newR1 : newR2,
        ratingDelta: callerUid === whiteUid ? delta1 : delta2,
      });
    } catch (err: any) {
      console.error("Failed to apply ranked match result:", err);
      res.status(500).json({ error: "Failed to apply match result to database" });
    }
  });

  // GET active/open tournament
  app.get("/api/tournaments/active", async (req, res) => {
    const hasAdmin = admin.apps.length > 0 && db !== null;
    if (!hasAdmin) {
      return res.json({
        id: "mock_t",
        name: "Crown Championship 2026",
        status: "active",
        players: [
          { uid: "u1", name: "Alice" },
          { uid: "u2", name: "Bob" },
          { uid: "u3", name: "Charlie" },
          { uid: "u4", name: "Dave" }
        ],
        rounds: [
          {
            roundIndex: 0,
            name: "Semifinals",
            matches: [
              { matchId: "m1", player1: { uid: "u1", name: "Alice" }, player2: { uid: "u2", name: "Bob" }, winnerUid: null, roomId: "mock_room_1", status: "pending" },
              { matchId: "m2", player1: { uid: "u3", name: "Charlie" }, player2: { uid: "u4", name: "Dave" }, winnerUid: null, roomId: "mock_room_2", status: "pending" }
            ]
          }
        ],
        winner: null
      });
    }

    try {
      const snap = await db.collection("tournaments").where("status", "in", ["registration", "active"]).limit(1).get();
      if (snap.empty) {
        return res.json(null);
      }
      const doc = snap.docs[0];
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch active tournament" });
    }
  });

  // POST register user for active tournament
  app.post("/api/tournaments/register", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    
    const hasAdmin = admin.apps.length > 0 && db !== null;
    let callerUid: string;
    try {
      const isProduction = process.env.NODE_ENV === "production";
      if (!hasAdmin) {
        if (!isProduction) {
          callerUid = idToken; // dev mock
        } else {
          return res.status(500).json({ error: "Firebase Admin is not initialized" });
        }
      } else {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        callerUid = decodedToken.uid;
      }
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (!hasAdmin) {
      return res.json({ success: true, message: "Registered (Dev Mock)" });
    }

    try {
      const snap = await db.collection("tournaments").where("status", "==", "registration").limit(1).get();
      if (snap.empty) {
        return res.status(400).json({ error: "No open tournament registration" });
      }
      const tDoc = snap.docs[0];
      const tData = tDoc.data();
      const players = tData.players || [];
      
      if (players.some((p: any) => p.uid === callerUid)) {
        return res.status(400).json({ error: "Player already registered" });
      }

      const userSnap = await db.collection("users").doc(callerUid).get();
      const userName = userSnap.exists ? (userSnap.data().name || "Champion") : "Champion";

      players.push({ uid: callerUid, name: userName });
      await tDoc.ref.update({ players });
      
      res.json({ success: true, players });
    } catch (err) {
      res.status(500).json({ error: "Failed to register player" });
    }
  });

  // POST start tournament (admin only)
  app.post("/api/tournaments/start", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    
    const hasAdmin = admin.apps.length > 0 && db !== null;
    let callerUid: string;
    try {
      const isProduction = process.env.NODE_ENV === "production";
      if (!hasAdmin) {
        callerUid = "mock_admin";
      } else {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        callerUid = decodedToken.uid;
        if (!decodedToken.admin) {
          const userSnap = await db.collection("users").doc(callerUid).get();
          if (!userSnap.exists || userSnap.data().role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Admin only" });
          }
        }
      }
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (!hasAdmin) {
      return res.json({ success: true, message: "Tournament started (Dev Mock)" });
    }

    try {
      const snap = await db.collection("tournaments").where("status", "==", "registration").limit(1).get();
      if (snap.empty) {
        return res.status(400).json({ error: "No tournament in registration phase" });
      }
      const tDoc = snap.docs[0];
      const tData = tDoc.data();
      const players = tData.players || [];

      if (players.length < 2) {
        return res.status(400).json({ error: "At least 2 players required to start tournament" });
      }

      const shuffled = [...players].sort(() => Math.random() - 0.5);

      const matches = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          const matchId = `match_${tDoc.id}_0_${i/2}`;
          matches.push({
            matchId,
            player1: shuffled[i],
            player2: shuffled[i+1],
            winnerUid: null,
            roomId: `room_${tDoc.id}_0_${i/2}`,
            status: "pending"
          });
        } else {
          const matchId = `match_${tDoc.id}_0_${i/2}`;
          matches.push({
            matchId,
            player1: shuffled[i],
            player2: { uid: "bye", name: "BYE" },
            winnerUid: shuffled[i].uid,
            roomId: null,
            status: "completed"
          });
        }
      }

      const rounds = [{
        roundIndex: 0,
        name: "Round 1",
        matches
      }];

      await tDoc.ref.update({
        status: "active",
        rounds
      });

      res.json({ success: true, rounds });
    } catch (err) {
      res.status(500).json({ error: "Failed to start tournament" });
    }
  });

  // POST report-result for tournament match (authenticated)
  app.post("/api/tournaments/report-result", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    
    const hasAdmin = admin.apps.length > 0 && db !== null;
    let callerUid: string;
    try {
      const isProduction = process.env.NODE_ENV === "production";
      if (!hasAdmin) {
        callerUid = idToken; // dev mock
      } else {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        callerUid = decodedToken.uid;
      }
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const {
      tournamentId,
      matchId,
      roomId,
      whiteUid,
      blackUid,
      result,
      moveCount,
      timestamp,
      verificationHash,
    } = req.body;

    if (!tournamentId || !matchId || !roomId || !whiteUid || !blackUid || !result || moveCount === undefined || !timestamp || !verificationHash) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const crypto = await import("crypto");
    const payload = `${roomId}:${whiteUid}:${blackUid}:${result}:${moveCount}:${timestamp}`;
    const secret = process.env.RANKED_RESULT_HMAC_SECRET || "default_ranked_secret";
    const expectedHash = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (expectedHash !== verificationHash) {
      return res.status(400).json({ error: "Invalid result signature" });
    }

    if (!hasAdmin) {
      return res.json({ success: true, message: "Tournament result reported (Dev Mock)" });
    }

    try {
      const tRef = db.collection("tournaments").doc(tournamentId);
      await db.runTransaction(async (transaction: any) => {
        const tSnap = await transaction.get(tRef);
        if (!tSnap.exists) {
          throw new Error("Tournament not found");
        }
        const tData = tSnap.data();
        const rounds = tData.rounds || [];
        
        const currentRound = rounds[rounds.length - 1];
        if (!currentRound) {
          throw new Error("No active round found");
        }

        const match = currentRound.matches.find((m: any) => m.matchId === matchId);
        if (!match) {
          throw new Error("Match not found in current round");
        }

        if (match.status === "completed") {
          return;
        }

        let winnerUid = null;
        if (result === "white_win") {
          winnerUid = whiteUid;
        } else if (result === "black_win") {
          winnerUid = blackUid;
        } else {
          winnerUid = Math.random() < 0.5 ? whiteUid : blackUid;
        }

        match.winnerUid = winnerUid;
        match.status = "completed";

        const roundFinished = currentRound.matches.every((m: any) => m.status === "completed");

        if (roundFinished) {
          const winners = currentRound.matches.map((m: any) => ({
            uid: m.winnerUid,
            name: m.winnerUid === m.player1.uid ? m.player1.name : m.player2.name
          }));

          if (winners.length === 1) {
            tData.winner = winners[0];
            tData.status = "completed";
            
            const winnerRef = db.collection("users").doc(winners[0].uid);
            const winnerSnap = await transaction.get(winnerRef);
            if (winnerSnap.exists) {
              const wins = (winnerSnap.data().tournamentWins || 0) + 1;
              transaction.update(winnerRef, { tournamentWins: wins });
            }
          } else {
            const nextMatches = [];
            for (let i = 0; i < winners.length; i += 2) {
              if (i + 1 < winners.length) {
                const nextMatchId = `match_${tournamentId}_${rounds.length}_${i/2}`;
                nextMatches.push({
                  matchId: nextMatchId,
                  player1: winners[i],
                  player2: winners[i+1],
                  winnerUid: null,
                  roomId: `room_${tournamentId}_${rounds.length}_${i/2}`,
                  status: "pending"
                });
              } else {
                const nextMatchId = `match_${tournamentId}_${rounds.length}_${i/2}`;
                nextMatches.push({
                  matchId: nextMatchId,
                  player1: winners[i],
                  player2: { uid: "bye", name: "BYE" },
                  winnerUid: winners[i].uid,
                  roomId: null,
                  status: "completed"
                });
              }
            }

            rounds.push({
              roundIndex: rounds.length,
              name: winners.length === 2 ? "Finals" : "Semifinals",
              matches: nextMatches
            });
          }
        }

        transaction.update(tRef, { rounds, status: tData.status, winner: tData.winner || null });
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to report tournament result:", err);
      res.status(500).json({ error: err.message || "Failed to process tournament match result" });
    }
  });

  // WebSocket Game Logic
  const games = new Map<string, Chess>();

    const userSockets = new Map<string, string>(); // userId -> socketId

    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);
      let currentUserId: string | null = null;
      let currentGameId: string | null = null;

      socket.on("joinGame", (gameId, userId) => {
        socket.join(gameId);
        currentUserId = userId;
        currentGameId = gameId;
        userSockets.set(userId, socket.id);

        if (!games.has(gameId)) {
          games.set(gameId, new Chess());
        }
        console.log(`Socket ${socket.id} (User: ${userId}) joined game ${gameId}`);
      });

    // Latency Monitoring (RTT)
    socket.on("ping_client", (data) => {
      socket.emit("pong_server", {
        t: data.t,
        server_t: Date.now()
      });
    });

    socket.on("move", async (data) => {
      const { gameId, move, userId } = data;
      const game = games.get(gameId);

      if (game) {
        try {
          const result = game.move(move);
          if (result) {
            io.to(gameId).emit("moveValidated", {
              fen: game.fen(),
              move: result,
              turn: game.turn(),
              isGameOver: game.isGameOver()
            });

            // Anti-Cheat: Engine Correlation (simplified version)
            // Check if player's move matches engine's best move (simulated for now, would call Rust engine)
            if (process.env.NODE_ENV === 'production' && Math.random() < 0.2) { // 20% audit rate
               auditMoveForCheating(userId, game.fen(), move);
            }

            if (game.isGameOver()) {
              await handleGameEnd(gameId, game);
            }
          } else {
            socket.emit("invalidMove", { move });
          }
        } catch (e) {
          socket.emit("invalidMove", { move, error: (e as Error).message });
        }
      }
    });

    socket.on("resign", async (data) => {
      const { gameId, userId } = data;
      const game = games.get(gameId);
      if (game) {
        const winner = game.turn() === 'w' ? 'black' : 'white';
        io.to(gameId).emit("gameEnded", {
          winner,
          reason: "resignation",
          fen: game.fen()
        });
        await handleGameEnd(gameId, game);
      }
    });

    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);
      if (currentUserId) userSockets.delete(currentUserId);

      // Leaver's Policy (Shadow Pool)
      if (currentGameId && games.has(currentGameId)) {
        const game = games.get(currentGameId);
        if (game && !game.isGameOver()) {
          console.warn(`User ${currentUserId} disconnected during active game ${currentGameId}`);
          if (currentUserId && db) {
            try {
               const userRef = db.collection('users').doc(currentUserId);
               await db.runTransaction(async (t: any) => {
                 const doc = await t.get(userRef);
                 if (doc.exists()) {
                   const count = (doc.data().leaversCount || 0) + 1;
                   const shadow = count > 5; // Flag after 5 leaves
                   t.update(userRef, { 
                     leaversCount: count,
                     shadowPool: shadow 
                   });
                 }
               });
            } catch (err) {
               console.error("Failed to update leaver status", err);
            }
          }
        }
      }
    });

    async function auditMoveForCheating(userId: string, fen: string, move: any) {
      // Non-blocking audit
      setImmediate(async () => {
        try {
          const response = await fetch("http://localhost:3001/api/engine/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fen, move_str: move.lan || move.san || String(move), tier: "audit" })
          });
          if (response.ok) {
            const data: any = await response.json();
            if (!data.is_valid) {
               console.warn(`Cheating Suspected: User ${userId} played illegal move according to Rust engine.`);
               // In production, we would increment a suspicious counter
            }
          }
        } catch (err) {
          console.error("Audit Engine Error:", err);
        }
      });
    }
  });

  async function handleGameEnd(gameId: string, game: Chess) {
    let winner = "draw";

    if (game.isCheckmate()) {
      winner = game.turn() === 'w' ? 'black' : 'white';
    } else if (game.isDraw()) {
      winner = "draw";
    }

    io.to(gameId).emit("gameEnded", { 
      winner, 
      reason: game.isCheckmate() ? "checkmate" : (game.isDraw() ? "draw" : "completed"),
      fen: game.fen()
    });

    // Reverted security patch: Server no longer updates database stats.
    // Client is now responsible for updating their own stats locally.
    console.log(`Game ${gameId} ended. Winner: ${winner}`);
    games.delete(gameId);
  }

  async function progressPlayer(userId: string) {
    if (!db) return console.error("Database not initialized for progressPlayer");
    try {
      await db.runTransaction(async (transaction: any) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) return;

        const data = userDoc.data();
        if (!data) return;

        let { tier, char } = data;
        const TIER_LENGTHS = [5, 5, 5, 5, 5, 5]; // Example lengths, should match TIER_NAMES

        char++;
        if (char >= (TIER_LENGTHS[tier] || 5)) {
          char = 0;
          tier = Math.min(tier + 1, 5);
        }

        transaction.update(userRef, { tier, char });
      });
    } catch (error) {
      console.error("Progression Error:", error);
    }
  }

  async function flagUser(userId: string, reason: string, evidence: any) {
    console.log(`Flagging user ${userId} for: ${reason}`);
    if (!db) return console.error("Database not initialized for flagUser");
    try {
      // Record the incident for admin review
      await db.collection('reports').add({
        userId,
        reason,
        evidence,
        status: 'pending_review',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Move to shadow pool (Cheater Pool)
      await db.collection('users').doc(userId).update({
        isFlagged: true,
        flaggedReason: reason
      });
    } catch (error) {
      console.error("Flagging Error:", error);
    }
  }

  async function updateEloRatings(player1Id: string, player2Id: string, isDraw: boolean) {
    const K = 32;
    if (!db) return console.error("Database not initialized for updateEloRatings");
    try {
      await db.runTransaction(async (transaction: any) => {
        const p1Ref = db.collection('users').doc(player1Id);
        const p2Ref = db.collection('users').doc(player2Id);
        
        const [p1Doc, p2Doc] = await Promise.all([transaction.get(p1Ref), transaction.get(p2Ref)]);
        
        if (!p1Doc.exists || !p2Doc.exists) return;

        const r1 = p1Doc.data()?.rating || 300;
        const r2 = p2Doc.data()?.rating || 300;

        const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
        const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));

        let s1 = 0.5, s2 = 0.5;
        if (!isDraw) {
          s1 = 1; // Player 1 is winner
          s2 = 0;
        }

        const newR1 = Math.round(r1 + K * (s1 - e1));
        const newR2 = Math.round(r2 + K * (s2 - e2));

        transaction.update(p1Ref, { 
          rating: newR1,
          wins: isDraw ? p1Doc.data()?.wins : (p1Doc.data()?.wins || 0) + 1,
          draws: isDraw ? (p1Doc.data()?.draws || 0) + 1 : p1Doc.data()?.draws
        });
        transaction.update(p2Ref, { 
          rating: newR2,
          losses: isDraw ? p2Doc.data()?.losses : (p2Doc.data()?.losses || 0) + 1,
          draws: isDraw ? (p2Doc.data()?.draws || 0) + 1 : p2Doc.data()?.draws
        });
      });
      console.log(`Ratings updated for ${player1Id} and ${player2Id}`);
    } catch (error) {
      console.error("Elo Update Error:", error);
    }
  }

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    console.log("Starting in development mode with Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/@vite') || req.url.includes('.')) {
        return next();
      }
      try {
        const template = fs.readFileSync(path.resolve(resolvedDirname, "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    console.log(`Serving static files from: ${distPath}`);
    if (!fs.existsSync(distPath)) {
      console.error(`ERROR: dist directory not found at ${distPath}`);
    }
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application not built correctly. index.html missing.");
      }
    });
  }

  console.log(`📡 Attempting to start server on 0.0.0.0:${PORT}...`);
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server successfully running on http://0.0.0.0:${PORT}`);
    
    // Ensure Rust Engine is Running (deferred to after server start)
    if (isProduction || fs.existsSync("./engine") || fs.existsSync("./src-rust/target/release/chess-engine-backend")) {
      console.log("🚀 Spawning Rust Engine process...");
      const enginePath = fs.existsSync("./engine") ? "./engine" : "./src-rust/target/release/chess-engine-backend";
      if (fs.existsSync(enginePath)) {
        const engineProcess = spawn(enginePath, [], {
          stdio: "inherit",
          env: { ...process.env, RUST_LOG: "info" }
        });
        engineProcess.on("error", (err) => console.error("Failed to start engine:", err));
      } else {
        console.warn("Rust Engine binary not found at:", enginePath);
      }
    }
  });
} catch (err) {
  console.error("CRITICAL SERVER STARTUP ERROR:", err);
}
}

startServer();
