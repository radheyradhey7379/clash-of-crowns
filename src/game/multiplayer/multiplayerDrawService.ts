import { db, doc, getDoc, setDoc, updateDoc, collection, getDocs, onSnapshot, writeBatch } from '../../firebase';
import { DrawOffer, MultiplayerResult } from './multiplayerTypes';

export async function createDrawOffer(roomId: string, fromUid: string, toUid: string): Promise<DrawOffer> {
  if (!roomId || !fromUid || !toUid) {
    throw new Error('Room ID, Sender UID, and Recipient UID are required.');
  }

  // Check if there is an active pending draw offer
  const activeOffer = await getActiveDrawOffer(roomId);
  if (activeOffer) {
    throw new Error('An active pending draw offer already exists.');
  }

  const offerId = 'offer_' + Date.now();
  const offerDocRef = doc(db, 'multiplayerRooms', roomId, 'drawOffers', offerId);

  const drawOffer: DrawOffer = {
    offerId,
    roomId,
    fromUid,
    toUid,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 1000, // Expires in 60 seconds
  };

  await setDoc(offerDocRef, drawOffer);
  return drawOffer;
}

export async function getActiveDrawOffer(roomId: string): Promise<DrawOffer | null> {
  const drawOffersCol = collection(db, 'multiplayerRooms', roomId, 'drawOffers');
  const snap = await getDocs(drawOffersCol);
  
  const now = Date.now();
  for (const doc of snap.docs) {
    const offer = doc.data() as DrawOffer;
    if (offer.status === 'pending' && offer.expiresAt > now) {
      return offer;
    }
  }
  return null;
}

export function subscribeToDrawOffers(roomId: string, callback: (offer: DrawOffer | null) => void): () => void {
  const drawOffersCol = collection(db, 'multiplayerRooms', roomId, 'drawOffers');

  const unsubscribe = onSnapshot(drawOffersCol, (snapshot) => {
    let activeOffer: DrawOffer | null = null;
    const now = Date.now();
    snapshot.forEach((doc) => {
      const offer = doc.data() as DrawOffer;
      if (offer.status === 'pending' && offer.expiresAt > now) {
        activeOffer = offer;
      }
    });
    callback(activeOffer);
  }, (err) => {
    console.error('Error subscribing to draw offers:', err);
  });

  return unsubscribe;
}

export async function acceptDrawOffer(roomId: string, offerId: string, uid: string): Promise<void> {
  const offerDocRef = doc(db, 'multiplayerRooms', roomId, 'drawOffers', offerId);
  const snap = await getDoc(offerDocRef);

  if (!snap.exists()) {
    throw new Error('Draw offer not found.');
  }

  const offer = snap.data() as DrawOffer;

  if (offer.status !== 'pending') {
    throw new Error('Draw offer is no longer pending.');
  }

  if (offer.expiresAt <= Date.now()) {
    throw new Error('Draw offer has expired.');
  }

  if (uid !== offer.toUid) {
    throw new Error('Only the recipient can accept this draw offer.');
  }

  // Atomically accept offer, update room status, and submit results
  const batch = writeBatch(db);

  batch.update(offerDocRef, { status: 'accepted' });

  const roomDocRef = doc(db, 'multiplayerRooms', roomId);
  const result: MultiplayerResult = {
    winnerUid: null,
    winnerColor: null,
    status: 'completed',
    reason: 'draw',
    endedAt: Date.now(),
  };

  batch.update(roomDocRef, {
    status: 'completed',
    result,
    updatedAt: Date.now(),
  });

  const resultDocRef = doc(db, 'multiplayerRooms', roomId, 'results', 'matchResult');
  batch.set(resultDocRef, result);

  await batch.commit();
}

export async function declineDrawOffer(roomId: string, offerId: string, uid: string): Promise<void> {
  const offerDocRef = doc(db, 'multiplayerRooms', roomId, 'drawOffers', offerId);
  const snap = await getDoc(offerDocRef);

  if (!snap.exists()) {
    throw new Error('Draw offer not found.');
  }

  const offer = snap.data() as DrawOffer;

  if (offer.status !== 'pending') {
    throw new Error('Draw offer is no longer pending.');
  }

  if (offer.expiresAt <= Date.now()) {
    throw new Error('Draw offer has expired.');
  }

  if (uid !== offer.toUid) {
    throw new Error('Only the recipient can decline this draw offer.');
  }

  await updateDoc(offerDocRef, { status: 'declined' });
}

export async function expireDrawOffer(roomId: string, offerId: string): Promise<void> {
  const offerDocRef = doc(db, 'multiplayerRooms', roomId, 'drawOffers', offerId);
  await updateDoc(offerDocRef, { status: 'expired' });
}
