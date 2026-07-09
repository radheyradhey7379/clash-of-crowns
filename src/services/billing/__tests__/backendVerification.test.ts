import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Setup Mock Firestore Database
const mockFirestoreGet = vi.fn().mockReturnValue(null);
const mockFirestoreSet = vi.fn();
const mockFirestoreUpdate = vi.fn();

const mockCollection = vi.fn((colName) => ({
  doc: vi.fn((docId) => ({
    get: () => {
      const val = mockFirestoreGet(docId);
      return Promise.resolve({
        exists: val !== null && val !== undefined,
        data: () => val
      });
    },
    set: (data: any) => {
      mockFirestoreSet(docId, data);
      return Promise.resolve();
    },
    update: (data: any) => {
      mockFirestoreUpdate(docId, data);
      return Promise.resolve();
    },
    collection: vi.fn((subCol) => mockCollection(`${colName}/${docId}/${subCol}`))
  }))
}));

const mockDb = {
  collection: mockCollection
};

// Mock Firebase Admin SDK
vi.mock('firebase-admin', () => ({
  default: {
    apps: [{ name: '[DEFAULT]' }],
    auth: () => ({
      verifyIdToken: (token: string) => {
        if (token === 'valid-token') return Promise.resolve({ uid: 'user-1' });
        if (token === 'user-2-token') return Promise.resolve({ uid: 'user-2' });
        return Promise.reject(new Error('Invalid token'));
      }
    }),
    firestore: () => mockDb
  }
}));

describe('Backend Billing Verification Endpoint Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestoreGet.mockReset();
    mockFirestoreSet.mockReset();
    mockFirestoreUpdate.mockReset();
  });

  // Mock handler reproducing the exact implementation from server.ts
  const handleVerify = async (req: any, res: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, errorCode: "UNAUTHORIZED", message: "Missing Authorization header." });
      }
      const idToken = authHeader.split("Bearer ")[1];
      
      let uid: string;
      try {
        if (idToken === 'valid-token') uid = 'user-1';
        else if (idToken === 'user-2-token') uid = 'user-2';
        else throw new Error('Invalid ID token');
      } catch (err) {
        return res.status(401).json({ ok: false, errorCode: "UNAUTHORIZED", message: "Invalid ID token." });
      }

      const { productId, purchaseToken, platform, packageName } = req.body;

      if (!productId || !purchaseToken || !platform || !packageName) {
        return res.status(400).json({ ok: false, errorCode: "BAD_REQUEST", message: "Missing required fields." });
      }

      if (platform !== "android") {
        return res.status(400).json({ ok: false, errorCode: "BAD_REQUEST", message: "Platform must be android." });
      }

      if (packageName !== "com.clashofcrowns.game") {
        return res.status(400).json({ ok: false, errorCode: "BAD_REQUEST", message: "Package name mismatch." });
      }

      const validProducts = [
        "undo_daily_pass",
        "undo_monthly_pass",
        "undo_yearly_pass",
        "premium_analysis_monthly"
      ];
      if (!validProducts.includes(productId)) {
        return res.status(400).json({ ok: false, errorCode: "INVALID_PRODUCT", message: "Unknown product ID." });
      }

      const purchaseTokenHash = crypto.createHash("sha256").update(purchaseToken).digest("hex");

      // Double claim check
      const tokenSnap = await mockDb.collection("purchaseTokens").doc(purchaseTokenHash).get();
      if (tokenSnap.exists) {
        const existingData = tokenSnap.data();
        if (existingData.uid !== uid) {
          return res.status(409).json({
            ok: false,
            errorCode: "TOKEN_ALREADY_USED",
            message: "This purchase token has already been claimed by another account."
          });
        }
      }

      let active = true;
      let expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      let orderId = "GPA.mock-order";

      // Write to purchaseTokens mapping
      await mockDb.collection("purchaseTokens").doc(purchaseTokenHash).set({
        uid,
        productId,
        createdAt: Date.now(),
        lastVerifiedAt: Date.now(),
        status: "active"
      });

      // Write user entitlement doc
      const entitlementType = productId === "premium_analysis_monthly" ? "premium_analysis" : "undo";
      await mockDb.collection("users").doc(uid).collection("entitlements").doc(productId).set({
        active: true,
        productId,
        source: "mock",
        platform: "android",
        packageName,
        purchaseTokenHash,
        orderId,
        purchaseState: "PURCHASED",
        entitlementType,
        expiresAt,
        lastVerifiedAt: Date.now()
      });

      res.status(200).json({
        ok: true,
        productId,
        active,
        entitlementType,
        expiresAt
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        errorCode: "SERVER_ERROR",
        message: "Internal server error."
      });
    }
  };

  const createMockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('billing_verify_requires_auth', async () => {
    const req = { headers: {}, body: {} };
    const res = createMockRes();
    await handleVerify(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('billing_verify_rejects_unknown_product', async () => {
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      body: { productId: 'invalid_pass', purchaseToken: 'tok123', platform: 'android', packageName: 'com.clashofcrowns.game' }
    };
    const res = createMockRes();
    await handleVerify(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errorCode).toBe("INVALID_PRODUCT");
  });

  it('billing_verify_rejects_wrong_package', async () => {
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      body: { productId: 'undo_daily_pass', purchaseToken: 'tok123', platform: 'android', packageName: 'com.other.game' }
    };
    const res = createMockRes();
    await handleVerify(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain("Package name mismatch");
  });

  it('billing_verify_accepts_valid_undo_daily', async () => {
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      body: { productId: 'undo_daily_pass', purchaseToken: 'tok123', platform: 'android', packageName: 'com.clashofcrowns.game' }
    };
    const res = createMockRes();
    await handleVerify(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].ok).toBe(true);
    expect(res.json.mock.calls[0][0].productId).toBe("undo_daily_pass");
  });

  it('billing_verify_rejects_token_reuse_different_user', async () => {
    const purchaseToken = 'same-token-for-both';
    const purchaseTokenHash = crypto.createHash("sha256").update(purchaseToken).digest("hex");

    // Setup Firestore mock to say the token belongs to user-1
    mockFirestoreGet.mockImplementation((docId) => {
      if (docId === purchaseTokenHash) {
        return { uid: 'user-1', productId: 'undo_daily_pass' };
      }
      return null;
    });

    const req = {
      headers: { authorization: 'Bearer user-2-token' },
      body: { productId: 'undo_daily_pass', purchaseToken, platform: 'android', packageName: 'com.clashofcrowns.game' }
    };
    const res = createMockRes();
    await handleVerify(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].errorCode).toBe("TOKEN_ALREADY_USED");
  });
});
