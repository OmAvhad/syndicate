import '../env.js';
import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { signRequest } from '@worldcoin/idkit-server';
import User from '../models/User.js';

const router = express.Router();

// Helper getters to always read fresh environment variables
const getAppId = () => process.env.APP_ID;
const getRpId = () => process.env.RP_ID;
const getAction = () => process.env.ACTION || 'login';
const getWorldIdEnv = () => process.env.WORLDID_ENV || 'staging';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/rp-context
// Returns a short-lived server-signed RpContext required by IDKit v4.
// The frontend passes this directly into IDKitRequestWidget.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/rp-context', (req, res) => {
  const signerKey = process.env.SIGNER_KEY; // 32-byte hex private key
  const rpId = getRpId();
  const action = getAction();
  const worldIdEnv = getWorldIdEnv();

  if (!signerKey) {
    return res.status(500).json({ error: 'SIGNER_KEY not configured' });
  }

  if (!rpId) {
    return res.status(500).json({ error: 'RP_ID not configured' });
  }

  try {
    const rpSig = signRequest({
      signingKeyHex: signerKey,
      action: action, // ← action name ("login"), not the RP ID
      ttl: 120, // 2-minute expiry
    });

    const rp_context = {
      rp_id: rpId,
      nonce: rpSig.nonce,
      created_at: rpSig.createdAt,
      expires_at: rpSig.expiresAt,
      signature: rpSig.sig,
    };

    console.log(`[WorldID] Generated rp_context for rp_id: ${rpId} (env: ${worldIdEnv}, action: ${action})`);
    return res.json({ rp_context, environment: worldIdEnv });
  } catch (err) {
    console.error('[WorldID] rp-context generation failed:', err.message);
    return res.status(500).json({ error: 'Failed to generate rp_context', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify
// Verifies the IDKit v4 proof result against the World ID API and
// issues a JWT.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  const appId = getAppId();
  const rpId = getRpId();
  const action = getAction();
  const worldIdEnv = getWorldIdEnv();

  console.log(`[WorldID] /api/auth/verify received request body keys:`, Object.keys(req.body));

  const result = req.body.result;
  const legacyFields = req.body;

  try {
    let nullifierHash = null;
    let verificationLevel = 'device';
    let verifyResponseData = null;

    if (result) {
      console.log(`[WorldID] Verifying IDKit v4 result (protocol: ${result.protocol_version}, env: ${result.environment || worldIdEnv})`);
      
      // Ensure environment field matches
      if (!result.environment) {
        result.environment = worldIdEnv;
      }

      // Try World ID v4 verify endpoint first (developer.world.org/api/v4/verify/{rp_id})
      const targetId = rpId || appId;
      const v4Url = `https://developer.world.org/api/v4/verify/${targetId}`;

      try {
        console.log(`[WorldID] Calling v4 verification endpoint: ${v4Url}`);
        const v4Res = await axios.post(v4Url, result, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
        verifyResponseData = v4Res.data;
        console.log(`[WorldID] v4 verification successful:`, verifyResponseData);
      } catch (v4Err) {
        console.warn(`[WorldID] v4 verification endpoint failed:`, v4Err?.response?.data || v4Err.message);

        // Fallback to v2 verify if v4 fails or if using legacy proof items
        const responses = Array.isArray(result.responses)
          ? result.responses
          : (Array.isArray(result.items) ? result.items : []);
        
        const proofItem = responses[0];
        if (!proofItem) {
          throw new Error('No proof responses found in IDKitResult');
        }

        const v2BaseUrl = worldIdEnv === 'staging'
          ? 'https://staging-developer.worldcoin.org/api/v2/verify'
          : 'https://developer.worldcoin.org/api/v2/verify';

        const v2Payload = {
          proof: proofItem.proof,
          nullifier_hash: proofItem.nullifier || proofItem.nullifier_hash,
          merkle_root: proofItem.merkle_root,
          verification_level: proofItem.identifier || 'device',
          action: action,
          signal: proofItem.signal_hash || '',
          staging: worldIdEnv === 'staging',
        };

        console.log(`[WorldID] Attempting fallback to v2 verification (${v2BaseUrl}/${appId})...`);
        const v2Res = await axios.post(`${v2BaseUrl}/${appId}`, v2Payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
        verifyResponseData = v2Res.data;
        console.log(`[WorldID] v2 fallback verification successful:`, verifyResponseData);
      }

      // Extract nullifier and verification level
      const responses = Array.isArray(result.responses)
        ? result.responses
        : (Array.isArray(result.items) ? result.items : []);
      const firstResponse = responses[0] || {};

      nullifierHash =
        verifyResponseData?.nullifier ||
        verifyResponseData?.nullifier_hash ||
        firstResponse?.nullifier ||
        firstResponse?.nullifier_hash ||
        result?.nullifier;

      verificationLevel = firstResponse?.identifier || verifyResponseData?.verification_level || 'device';
    } else {
      // ── Legacy v2/v3 direct payload path ─────────────────────────────────
      const { proof, nullifier_hash, merkle_root, verification_level, signal } = legacyFields;
      nullifierHash = nullifier_hash;
      verificationLevel = verification_level || 'orb';

      const v2BaseUrl = worldIdEnv === 'staging'
        ? 'https://staging-developer.worldcoin.org/api/v2/verify'
        : 'https://developer.worldcoin.org/api/v2/verify';

      const verifyPayload = {
        nullifier_hash,
        proof,
        merkle_root,
        verification_level,
        action: action,
        signal: signal || '',
        staging: worldIdEnv === 'staging',
      };

      console.log(`[WorldID] Verifying legacy v2 payload (${v2BaseUrl}/${appId})...`);
      const v2Res = await axios.post(`${v2BaseUrl}/${appId}`, verifyPayload);
      verifyResponseData = v2Res.data;
    }

    if (!nullifierHash) {
      console.error('[WorldID] Could not determine nullifier from verification response:', verifyResponseData);
      return res.status(400).json({ error: 'Could not extract nullifier from verification' });
    }

    console.log(`[WorldID] User verified! Nullifier: ${nullifierHash}`);

    // Upsert user in MongoDB
    const now = new Date();
    const user = await User.findOneAndUpdate(
      { nullifierHash },
      {
        $set: {
          lastLogin: now,
          verificationLevel,
        },
        $inc: { loginCount: 1 },
        $setOnInsert: {
          nullifierHash,
          createdAt: now,
        },
      },
      { upsert: true, new: true }
    );

    // Generate JWT
    const secret = process.env.JWT_SECRET || 'world-id-secret-key-2024';
    const token = jwt.sign(
      { nullifierHash: user.nullifierHash, userId: user._id },
      secret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        nullifierHash: user.nullifierHash,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        verificationLevel: user.verificationLevel,
        loginCount: user.loginCount,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    const errorDetails = error?.response?.data || error?.message;
    console.error('[WorldID] Verification failed in /api/auth/verify:', errorDetails);

    return res.status(400).json({
      error: 'Proof verification failed',
      details: errorDetails,
    });
  }
});

export default router;
