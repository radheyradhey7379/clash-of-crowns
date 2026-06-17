import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppScreen, PlayerData, TIER_LABELS, TIER_COLORS } from '../../types';
import { ChevronLeft, Send, MessageSquare, Users, Globe, Smile, User, MoreVertical, X, Swords } from 'lucide-react';
import { auth, db, handleFirestoreError } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, getDoc, where, updateDoc, Timestamp } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import { cn } from '../../lib/utils';
import { subscribeToChatInbox, markChatMessageRead } from '../../game/social/chatInboxService';
import { getPlayerPublicPreview } from '../../game/social/playerPreviewService';
import { acceptChallenge, declineChallenge } from '../../game/social/challengeService';
import { acceptChallengeAndCreateRoom, enterChallengeRoom } from '../../game/social/challengeRoomService';
import { ChatInboxMessage, PlayerPublicPreview as PublicPreview } from '../../game/social/challengeTypes';
import { isChallengeMatchEnabled, getDisabledFeatureMessage } from '../../lib/config/featureFlags';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface Message {
  id: string;
  sender: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  timestamp: any;
  reactions?: Record<string, string[]>; // emoji -> [uids]
}

export default function ChatScreen({ 
  onNavigate, 
  playerData,
  onViewProfile
}: { 
  onNavigate: (screen: AppScreen, characterId?: string | null, localConfig?: any, multiConfig?: any) => void, 
  playerData: PlayerData,
  onViewProfile: (uid: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'world' | 'friends' | 'challenges'>('world');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<PlayerData | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [showReactionMenu, setShowReactionMenu] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Challenge states
  const [challenges, setChallenges] = useState<ChatInboxMessage[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<ChatInboxMessage | null>(null);
  const [challengerPreview, setChallengerPreview] = useState<PublicPreview | null>(null);
  const [challengeActionStatus, setChallengeActionStatus] = useState<string | null>(null);

  const userUid = playerData.uid;

  // Real-time Chat Inbox listener
  useEffect(() => {
    if (!userUid) return;
    const unsubscribe = subscribeToChatInbox(userUid, (msgs) => {
      setChallenges(msgs);
    });
    return () => unsubscribe();
  }, [userUid]);

  useEffect(() => {
    if (!userUid) return;
    
    // Fetch friends list
    const q1 = query(collection(db, 'friendRequests'), where('from', '==', userUid), where('status', '==', 'accepted'));
    const q2 = query(collection(db, 'friendRequests'), where('to', '==', userUid), where('status', '==', 'accepted'));
    
    const unsub1 = onSnapshot(q1, async (snapshot) => {
      const friendIds = snapshot.docs.map(doc => doc.data().to);
      const friendData = await Promise.all(friendIds.map(async id => {
        const d = await getDoc(doc(db, 'users', id));
        return d.exists() ? { ...d.data(), uid: id } : null;
      }));
      setFriends(prev => {
        const combined = [...prev, ...friendData.filter(f => f !== null)];
        const unique = Array.from(new Map(combined.map(item => [item.uid, item])).values());
        return unique;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'friendRequests');
    });

    const unsub2 = onSnapshot(q2, async (snapshot) => {
      const friendIds = snapshot.docs.map(doc => doc.data().from);
      const friendData = await Promise.all(friendIds.map(async id => {
        const d = await getDoc(doc(db, 'users', id));
        return d.exists() ? { ...d.data(), uid: id } : null;
      }));
      setFriends(prev => {
        const combined = [...prev, ...friendData.filter(f => f !== null)];
        const unique = Array.from(new Map(combined.map(item => [item.uid, item])).values());
        return unique;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'friendRequests');
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [userUid]);

  useEffect(() => {
    const twentyFourHoursAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

    if (activeTab === 'world') {
      const q = query(
        collection(db, 'worldChat'), 
        where('timestamp', '>=', twentyFourHoursAgo),
        orderBy('timestamp', 'desc'), 
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(msgs.reverse());
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'worldChat');
      });
      return () => unsubscribe();
    } else if (activeTab === 'friends' && selectedFriend && userUid) {
      const chatId = [userUid, selectedFriend.uid].sort().join('_');
      const q = query(
        collection(db, 'chats', chatId, 'messages'), 
        where('timestamp', '>=', twentyFourHoursAgo),
        orderBy('timestamp', 'desc'), 
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(msgs.reverse());
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
      });
      return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [activeTab, selectedFriend, userUid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !userUid) return;

    try {
      if (activeTab === 'world') {
        await addDoc(collection(db, 'worldChat'), {
          sender: userUid,
          senderName: playerData.name,
          senderPhoto: playerData.photoURL || "",
          text: inputText,
          timestamp: serverTimestamp(),
          reactions: {}
        });
      } else if (selectedFriend) {
        const chatId = [userUid, selectedFriend.uid].sort().join('_');
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          sender: userUid,
          senderName: playerData.name,
          senderPhoto: playerData.photoURL || "",
          text: inputText,
          timestamp: serverTimestamp(),
          reactions: {}
        });
      }
      setInputText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, activeTab === 'world' ? 'worldChat' : 'messages');
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!userUid) return;
    try {
      const collectionPath = activeTab === 'world' 
        ? collection(db, 'worldChat') 
        : collection(db, 'chats', [userUid, selectedFriend.uid].sort().join('_'), 'messages');
      
      const msgRef = doc(collectionPath, messageId);
      const msgDoc = await getDoc(msgRef);
      if (msgDoc.exists()) {
        const data = msgDoc.data();
        const reactions = { ...(data.reactions || {}) };
        const users = [...(reactions[emoji] || [])];
        
        if (users.includes(userUid)) {
          reactions[emoji] = users.filter((id: string) => id !== userUid);
        } else {
          reactions[emoji] = [...users, userUid];
        }
        
        await updateDoc(msgRef, { reactions });
      }
      setShowReactionMenu(null);
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const viewUserProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setViewingProfile({ ...userDoc.data(), uid } as PlayerData);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  };

  const handleChallengeClick = async (challenge: ChatInboxMessage) => {
    if (!userUid) return;
    setSelectedChallenge(challenge);
    setChallengerPreview(null);
    setChallengeActionStatus(null);
    
    // Mark inbox item as read
    await markChatMessageRead(userUid, challenge.id);

    // Fetch preview details
    const preview = await getPlayerPublicPreview(challenge.challengerUid);
    setChallengerPreview(preview);
  };

  return (
    <div className="screen-root flex flex-col h-full bg-[#000] relative">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onNavigate('Home')}
            className="p-2 bg-black/40 border border-white/10 rounded-full text-[#d9ad33] hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={24} />
          </motion.button>
          <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.2em] font-serif uppercase">COURT CHAT</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-4 gap-2 bg-black/20 z-10">
        <button
          onClick={() => setActiveTab('world')}
          className={`flex-1 py-3 rounded-xl font-bold tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'world' ? 'bg-[#d9ad33] text-black shadow-lg' : 'bg-black/40 border border-white/5 text-white/40'
          }`}
        >
          <Globe size={16} />
          WORLD
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-3 rounded-xl font-bold tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'friends' ? 'bg-[#d9ad33] text-black shadow-lg' : 'bg-black/40 border border-white/5 text-white/40'
          }`}
        >
          <Users size={16} />
          ALLIES
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          className={`flex-1 py-3 rounded-xl font-bold tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'challenges' ? 'bg-[#d9ad33] text-black shadow-lg' : 'bg-black/40 border border-white/5 text-white/40'
          }`}
        >
          <Swords size={16} />
          CHALLENGES
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-smooth z-10"
      >
        {activeTab === 'friends' && !selectedFriend && (
          <div className="flex-1 flex flex-col gap-4">
            <h3 className="text-[#8c7a52] text-xs font-bold tracking-[0.2em] uppercase px-2">Your Allies</h3>
            {friends.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/10 gap-4 mt-12">
                <Users size={48} strokeWidth={1} />
                <p className="font-serif tracking-widest uppercase text-sm">No allies found...</p>
                <button onClick={() => onNavigate('Profile')} className="text-[#d9ad33] text-xs font-bold underline">SEARCH FOR ALLIES</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {friends.map(friend => (
                  <motion.button
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    key={friend.uid}
                    onClick={() => setSelectedFriend(friend)}
                    className="flex items-center gap-4 p-4 bg-black/40 border border-white/10 rounded-2xl hover:bg-white/5 transition-all text-left w-full"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d9ad33] to-[#8c661a] p-0.5">
                        <div className="w-full h-full rounded-full bg-[#030204] overflow-hidden">
                          <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} alt="" />
                        </div>
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-white font-bold">{friend.name}</span>
                        <span className="text-[#8c7a52] text-[10px] uppercase tracking-widest">{TIER_LABELS[friend.tier || 0]}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProfile(friend.uid);
                        onNavigate('Profile');
                      }}
                      className="p-2 text-[#d9ad33] hover:bg-white/10 rounded-full transition-colors"
                    >
                      <User size={18} />
                    </button>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'challenges' && (
          <div className="flex-1 flex flex-col gap-4">
            <h3 className="text-[#8c7a52] text-xs font-bold tracking-[0.2em] uppercase px-2">Challenges & Pokes</h3>
            {challenges.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/10 gap-4 mt-12">
                <Swords size={48} strokeWidth={1} />
                <p className="font-serif tracking-widest uppercase text-sm text-center">No challenges yet...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {challenges.map(chal => {
                  const isUnread = !chal.read;
                  return (
                    <motion.button
                      whileHover={{ scale: 1.01, x: 5 }}
                      whileTap={{ scale: 0.99 }}
                      key={chal.id}
                      onClick={() => handleChallengeClick(chal)}
                      className={cn(
                        "flex flex-col items-start gap-2 p-4 border rounded-2xl transition-all text-left w-full",
                        isUnread 
                          ? "bg-[#d9ad33]/10 border-[#d9ad33]/40 shadow-[0_0_15px_rgba(217,173,51,0.15)]" 
                          : "bg-black/40 border-white/10 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                          chal.status === 'pending' ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" :
                          chal.status === 'accepted' ? "bg-green-500/20 text-green-500 border border-green-500/30" :
                          chal.status === 'declined' ? "bg-red-500/20 text-red-500 border border-red-500/30" :
                          "bg-white/10 text-white/40 border border-white/10"
                        )}>
                          {chal.status}
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 bg-[#d9ad33] rounded-full animate-ping" />
                        )}
                      </div>
                      <p className="text-white text-xs leading-relaxed mt-1 font-sans">{chal.message}</p>
                      <span className="text-[8px] text-white/20 mt-1 uppercase tracking-wider font-bold">
                        {new Date(chal.createdAt).toLocaleString()}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab !== 'challenges' && (activeTab === 'world' || selectedFriend) && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-white/10 gap-4 mt-12">
            {activeTab === 'friends' && (
              <button onClick={() => setSelectedFriend(null)} className="absolute top-4 left-4 p-2 bg-black/40 border border-white/10 rounded-full text-[#d9ad33] hover:bg-white/10 transition-all shadow-md">
                <ChevronLeft size={16} />
              </button>
            )}
            <MessageSquare size={48} strokeWidth={1} />
            <p className="font-serif tracking-widest uppercase text-sm text-center">Silence in the court...</p>
          </div>
        )}

        {activeTab !== 'challenges' && (activeTab === 'world' || selectedFriend) && messages.length > 0 && (
          <div className="flex flex-col gap-4">
            {activeTab === 'friends' && (
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <button onClick={() => setSelectedFriend(null)} className="p-2 bg-black/40 border border-white/10 rounded-full text-[#d9ad33] hover:bg-white/10 transition-all shadow-md">
                  <ChevronLeft size={16} />
                </button>
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    onViewProfile(selectedFriend.uid);
                    onNavigate('Profile');
                  }}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d9ad33] to-[#8c661a] p-0.5">
                    <div className="w-full h-full rounded-full bg-[#030204] overflow-hidden">
                      <img src={selectedFriend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedFriend.name}`} alt="" />
                    </div>
                  </div>
                  <span className="text-white text-xs font-bold uppercase tracking-widest">{selectedFriend.name}</span>
                </div>
              </div>
            )}
            <div className="text-center py-2 bg-white/5 border border-white/10 rounded-xl mb-2">
              <span className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">
                Messages are automatically archived after 24 hours
              </span>
            </div>
            {messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={`flex gap-3 ${msg.sender === userUid ? 'flex-row-reverse' : ''}`}
              >
                <button 
                  onClick={() => viewUserProfile(msg.sender)}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d9ad33] to-[#8c661a] p-0.5 overflow-hidden flex-shrink-0"
                >
                  <div className="w-full h-full rounded-full bg-[#030204] overflow-hidden">
                    <img 
                      src={msg.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} 
                      alt={msg.senderName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </button>
                <div className={`flex flex-col max-w-[70%] ${msg.sender === userUid ? 'items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-[#8c7a52] uppercase">{msg.senderName}</span>
                    {msg.timestamp && (
                      <span className="text-[8px] text-white/20">
                        {new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <div 
                      onClick={() => setShowReactionMenu(showReactionMenu === msg.id ? null : msg.id)}
                      className={`p-3 rounded-2xl text-sm cursor-pointer transition-all ${
                        msg.sender === userUid 
                          ? 'bg-[#d9ad33] text-black rounded-tr-none shadow-lg' 
                          : 'bg-white/5 text-white border border-white/10 rounded-tl-none hover:bg-white/10'
                      }`}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }}
                    />
                    
                    {/* Reactions Display */}
                    {msg.reactions && Object.entries(msg.reactions).some(([_, users]) => users.length > 0) && (
                      <div className={`flex gap-1 mt-1 ${msg.sender === userUid ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, users]) => users.length > 0 && (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(msg.id, emoji)}
                            className={`px-1.5 py-0.5 rounded-full text-[10px] flex items-center gap-1 transition-all ${
                              users.includes(userUid || '') ? 'bg-[#d9ad33] text-black' : 'bg-white/10 text-white/60'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-bold">{users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reaction Menu */}
                    <AnimatePresence>
                      {showReactionMenu === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 10 }}
                          className={`absolute bottom-full mb-2 z-30 bg-black/90 border border-white/10 p-2 rounded-full flex gap-2 shadow-2xl backdrop-blur-md ${
                            msg.sender === userUid ? 'right-0' : 'left-0'
                          }`}
                        >
                          {['🔥', '👑', '⚔️', '🛡️', '🤝', '😂'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleAddReaction(msg.id, emoji)}
                              className="hover:scale-125 transition-transform text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/40 backdrop-blur-md border-t border-white/10 z-10">
        {activeTab === 'challenges' ? (
          <div className="text-center text-white/20 text-xs font-bold tracking-widest uppercase py-2">
            Select a challenge card to view status or options
          </div>
        ) : (activeTab === 'world' || selectedFriend) ? (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={userUid ? "Speak your mind, noble one..." : "Sign in to speak..."}
              disabled={!userUid}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d9ad33]/50 transition-all text-white placeholder-white/20"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={!userUid || !inputText.trim()}
              className="p-3 bg-[#d9ad33] text-black rounded-xl disabled:opacity-50 disabled:grayscale transition-all shadow-lg"
            >
              <Send size={20} />
            </motion.button>
          </form>
        ) : (
          <div className="text-center text-white/20 text-xs font-bold tracking-widest uppercase py-2">
            Select an ally to begin a private audience
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      <AnimatePresence>
        {viewingProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingProfile(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#030204] border border-white/10 w-full max-w-sm p-8 rounded-2xl shadow-2xl flex flex-col items-center"
            >
              <button onClick={() => setViewingProfile(null)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"><X size={24} /></button>
              
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#d9ad33] to-[#8c661a] p-1 mb-6 shadow-lg">
                <div className="w-full h-full rounded-full bg-[#030204] flex items-center justify-center overflow-hidden">
                  <img 
                    src={viewingProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingProfile.name}`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-[#f5d666] mb-1 tracking-widest uppercase font-serif">{viewingProfile.name}</h2>
              <div className="text-[#8c7a52] text-xs font-bold tracking-[0.3em] uppercase mb-8">
                {TIER_LABELS[viewingProfile.tier || 0]}
              </div>

              <div className="grid grid-cols-2 gap-4 w-full mb-6">
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-[#8c7a52] uppercase font-bold mb-1">Rating</div>
                  <div className="text-xl font-bold text-white">{viewingProfile.rating}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center">
                  <div className="text-[10px] text-[#8c7a52] uppercase font-bold mb-1">Wins</div>
                  <div className="text-xl font-bold text-white">{viewingProfile.wins}</div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onViewProfile(viewingProfile.uid);
                  onNavigate('Profile');
                }}
                className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold tracking-widest rounded-xl uppercase mb-3 hover:bg-white/10 transition-all"
              >
                VIEW FULL PROFILE
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setViewingProfile(null)}
                className="w-full py-3 bg-[#d9ad33] text-black font-bold tracking-widest rounded-xl uppercase shadow-lg"
              >
                CLOSE VIEW
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Challenge Inbox / Challenger Preview Modal */}
      <AnimatePresence>
        {selectedChallenge && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedChallenge(null);
                setChallengerPreview(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#030204] border border-white/10 w-full max-w-sm p-6 sm:p-8 rounded-2xl shadow-2xl flex flex-col items-center"
            >
              <button 
                onClick={() => {
                  setSelectedChallenge(null);
                  setChallengerPreview(null);
                }} 
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              {!challengerPreview ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-2 border-[#d9ad33] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    Loading Challenger Profile...
                  </span>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#d9ad33] to-[#8c661a] p-1 mb-4 shadow-lg">
                    <div className="w-full h-full rounded-full bg-[#030204] overflow-hidden">
                      <img 
                        src={challengerPreview.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${challengerPreview.name}`} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-[#f5d666] mb-1 tracking-widest uppercase font-serif text-center">
                    {challengerPreview.name}
                  </h2>
                  <div className="text-[8px] text-white/40 tracking-[0.2em] uppercase mb-4 text-center">
                    Challenger Profile
                  </div>

                  {/* Ranks & ELO Stats */}
                  <div className="grid grid-cols-2 gap-2 w-full mb-4">
                    <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-center">
                      <div className="text-[8px] text-[#8c7a52] uppercase font-bold mb-0.5">Comp Kings</div>
                      <div className="text-sm font-bold text-white">
                        {challengerPreview.compRank > 0 ? `#${challengerPreview.compRank}` : 'Unranked'}
                      </div>
                      <div className="text-[8px] text-white/40 font-serif">Elo: {challengerPreview.compElo}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-center">
                      <div className="text-[8px] text-[#8c7a52] uppercase font-bold mb-0.5">Arena Kings</div>
                      <div className="text-sm font-bold text-white">
                        {challengerPreview.arenaRank > 0 ? `#${challengerPreview.arenaRank}` : 'Unranked'}
                      </div>
                      <div className="text-[8px] text-white/40">Rating: 1200</div>
                    </div>
                  </div>

                  {/* Arena Stats */}
                  <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-4 flex flex-col gap-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-white/40 font-bold uppercase">Multiplayer Stats</span>
                      <span className="text-white font-bold">
                        {challengerPreview.arenaWins}W / {challengerPreview.arenaLosses}L / {challengerPreview.arenaDraws}D
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40 font-bold uppercase">Win Rate</span>
                      <span className="text-white font-bold">{challengerPreview.arenaWinRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40 font-bold uppercase">Total Matches</span>
                      <span className="text-white font-bold">{challengerPreview.arenaMatches}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  {challengerPreview.badges.length > 0 && (
                    <div className="w-full mb-6">
                      <div className="text-[8px] text-[#8c7a52] font-bold uppercase tracking-widest mb-1.5 text-center">
                        Badges ({challengerPreview.badges.length})
                      </div>
                      <div className="flex flex-wrap gap-1 justify-center max-h-16 overflow-y-auto custom-scrollbar">
                        {challengerPreview.badges.map(badge => (
                          <span key={badge} className="text-[8px] font-bold bg-white/5 border border-white/10 text-white/60 px-2 py-0.5 rounded-full uppercase">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action feedback */}
                  {challengeActionStatus && (
                    <div className="text-xs font-bold text-[#d9ad33] uppercase tracking-widest mb-4 animate-pulse">
                      {challengeActionStatus}
                    </div>
                  )}

                  {/* Interactive Options */}
                  {selectedChallenge.status === 'pending' || selectedChallenge.status === 'seen' ? (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex gap-2 w-full">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            if (!isChallengeMatchEnabled()) {
                              setChallengeActionStatus(getDisabledFeatureMessage('challenge'));
                              setTimeout(() => setChallengeActionStatus(null), 3000);
                              return;
                            }
                            setChallengeActionStatus('Accepting...');
                            const res = await acceptChallengeAndCreateRoom(selectedChallenge.challengeRequestId, userUid || '');
                            if (res.success) {
                              setChallengeActionStatus('Accepted!');
                              if (res.roomId) {
                                setSelectedChallenge(prev => prev ? { ...prev, status: 'accepted', roomId: res.roomId } : null);
                              } else {
                                setTimeout(() => {
                                  setSelectedChallenge(null);
                                  setChallengerPreview(null);
                                }, 1500);
                              }
                            } else {
                              setChallengeActionStatus(`Error: ${res.reason}`);
                            }
                          }}
                          className="flex-1 py-3 bg-green-600 text-white font-bold tracking-widest rounded-xl text-xs uppercase shadow-lg"
                        >
                          ACCEPT
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            setChallengeActionStatus('Declining...');
                            const res = await declineChallenge(selectedChallenge.challengeRequestId, userUid || '');
                            if (res.success) {
                              setChallengeActionStatus('Declined!');
                              setSelectedChallenge(prev => prev ? { ...prev, status: 'declined' } : null);
                              setTimeout(() => {
                                setSelectedChallenge(null);
                                setChallengerPreview(null);
                              }, 1500);
                            } else {
                              setChallengeActionStatus(`Error: ${res.reason}`);
                            }
                          }}
                          className="flex-1 py-3 bg-red-600 text-white font-bold tracking-widest rounded-xl text-xs uppercase shadow-lg"
                        >
                          DECLINE
                        </motion.button>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedChallenge(null);
                          setChallengerPreview(null);
                        }}
                        className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold tracking-widest rounded-xl text-xs uppercase hover:bg-white/10 transition-all"
                      >
                        IGNORE
                      </motion.button>
                    </div>
                  ) : selectedChallenge.status === 'accepted' && selectedChallenge.roomId ? (
                    <div className="flex flex-col gap-2 w-full">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          if (!isChallengeMatchEnabled()) {
                            setChallengeActionStatus(getDisabledFeatureMessage('challenge'));
                            setTimeout(() => setChallengeActionStatus(null), 3000);
                            return;
                          }
                          setChallengeActionStatus('Entering Match...');
                          const res = await enterChallengeRoom(selectedChallenge.challengeRequestId, userUid || '');
                          if (res) {
                            setSelectedChallenge(null);
                            setChallengerPreview(null);
                            onNavigate('Game', null, null, res);
                          } else {
                            setChallengeActionStatus('Failed to enter match. Room may not be ready.');
                          }
                        }}
                        className="w-full py-3 bg-[#d9ad33] text-black font-bold tracking-widest rounded-xl text-xs uppercase shadow-lg flex items-center justify-center gap-2"
                      >
                        <Swords size={16} />
                        ENTER MATCH
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedChallenge(null);
                          setChallengerPreview(null);
                        }}
                        className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold tracking-widest rounded-xl text-xs uppercase hover:bg-white/10 transition-all"
                      >
                        CLOSE VIEW
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedChallenge(null);
                        setChallengerPreview(null);
                      }}
                      className="w-full py-3 bg-[#d9ad33] text-black font-bold tracking-widest rounded-xl text-xs uppercase shadow-lg"
                    >
                      CLOSE VIEW
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
