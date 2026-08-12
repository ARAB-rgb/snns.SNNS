import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import { FlutterPhoneFrame } from './components/FlutterPhoneFrame';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { ChatList } from './components/ChatList';
import { ChatDetail } from './components/ChatDetail';
import { CallList } from './components/CallList';
import { CallScreen } from './components/CallScreen';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { ContactsList } from './components/ContactsList';
import { SettingsScreen } from './components/SettingsScreen';
import { StatusTab } from './components/StatusTab';
import { AuthModal } from './components/AuthModal';
import { NewChatModal } from './components/NewChatModal';
import { PrivacyModal } from './components/PrivacyModal';

import { User, Message, CallLog, ActiveCallState } from './types';
import { supabaseAuth } from './services/supabaseAuth';
import { supabaseService } from './services/supabaseService';
import { zegoCallService } from './services/zegoCallService';
import { sounds } from './services/audioSynthesizer';
import { OutgoingCallOverlay } from './components/OutgoingCallOverlay';

function AppContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(supabaseAuth.getActiveUser());
  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Array<{ id: string; otherUserId: string; lastMessage: string; lastMessageTime: string }>>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ callId: string; caller: User; type: 'audio' | 'video' } | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<{ callId: string; callee: User; type: 'audio' | 'video' } | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const usersRef = React.useRef<User[]>([]);
  usersRef.current = users;

  const outgoingCallRef = React.useRef<{ callId: string; callee: User; type: 'audio' | 'video' } | null>(null);
  outgoingCallRef.current = outgoingCall;

  const refreshUsers = () => {
    if (!currentUser) return;
    supabaseService.subscribeUsers(currentUser.id, (userList) => {
      setUsers(userList);
    });
  };

  // Subscribe to Supabase Auth User Changes
  useEffect(() => {
    const unsubscribe = supabaseAuth.onUserChange((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Zego Call Invitation for logged in user
  useEffect(() => {
    if (!currentUser) return;

    zegoCallService.initForUser(currentUser);

    zegoCallService.registerListeners({
      onIncomingCall: ({ callID, caller, callType }) => {
        const callerObj = usersRef.current.find((u) => u.id === caller.userID) || {
          id: caller.userID,
          name: caller.userName || 'متصل جديد',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          language: 'ar' as const,
          isOnline: true
        };
        setIncomingCall({
          callId: callID,
          caller: callerObj,
          type: callType === 1 ? 'video' : 'audio'
        });
      },
      onCallAccepted: () => {
        const currentOutgoing = outgoingCallRef.current;
        if (currentOutgoing) {
          const roomId = currentOutgoing.callId;
          setActiveCall({
            id: currentOutgoing.callId,
            roomId,
            participant: currentOutgoing.callee,
            type: currentOutgoing.type,
            status: 'connected',
            isMuted: false,
            isVideoOff: false,
            isSpeakerOn: true,
            isScreenSharing: false,
            isFrontCamera: true,
            durationSeconds: 0,
            hasLocalVideo: true,
            hasRemoteVideo: true,
            signalQuality: 'excellent'
          });
          setOutgoingCall(null);
        }
      },
      onCallEnded: () => {
        setOutgoingCall(null);
        setIncomingCall(null);
        setActiveCall(null);
      }
    });
  }, [currentUser?.id]);

  // Subscribe to Real Supabase Profiles
  useEffect(() => {
    if (!currentUser) {
      setUsers([]);
      return;
    }
    const unsubUsers = supabaseService.subscribeUsers(currentUser.id, (userList) => {
      setUsers(userList);
    });
    return () => unsubUsers();
  }, [currentUser?.id]);

  // Subscribe to Real Conversations for current user
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      return;
    }
    const unsub = supabaseService.subscribeConversations(currentUser.id, (convs) => {
      setConversations(convs);
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Subscribe to Real Supabase Call Logs
  useEffect(() => {
    if (!currentUser) {
      setCallLogs([]);
      return;
    }
    const unsub = supabaseService.subscribeCallLogs(currentUser.id, (logs) => {
      setCallLogs(logs);
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Subscribe to Real Incoming Calls
  useEffect(() => {
    if (!currentUser) return;
    const unsub = supabaseService.subscribeIncomingCalls(currentUser.id, (inc) => {
      if (inc) {
        console.log('🔔 [App] Incoming Realtime Call Received:', inc);
        const callerObj = usersRef.current.find((u) => u.id === inc.callerId) || {
          id: inc.callerId,
          name: 'متصل جديد',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          language: 'ar' as const,
          isOnline: true
        };
        setIncomingCall({ callId: inc.callId, caller: callerObj, type: inc.type });
        sounds.startRingtone();
      } else {
        setIncomingCall(null);
      }
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Subscribe to Messages when a chat is open
  useEffect(() => {
    if (!currentUser || !selectedUser) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    supabaseService.ensureConversation(currentUser.id, selectedUser.id).then((convId) => {
      if (cancelled || !convId) return;
      unsub = supabaseService.subscribeMessages(convId, (msgList) => {
        setMessages((prev) => ({
          ...prev,
          [selectedUser.id]: msgList
        }));
      });
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [currentUser?.id, selectedUser?.id]);

  // Listen for outgoing call acceptance or rejection
  useEffect(() => {
    if (!outgoingCall?.callId || !currentUser) return;

    const unsub = supabaseService.subscribeCallStatus(outgoingCall.callId, (status) => {
      if (status === 'accepted') {
        const roomId = outgoingCall.callId;
        setActiveCall({
          id: outgoingCall.callId,
          roomId,
          participant: outgoingCall.callee,
          type: outgoingCall.type,
          status: 'connected',
          isMuted: false,
          isVideoOff: false,
          isSpeakerOn: true,
          isScreenSharing: false,
          isFrontCamera: true,
          durationSeconds: 0,
          hasLocalVideo: true,
          hasRemoteVideo: true,
          signalQuality: 'excellent'
        });
        setOutgoingCall(null);
      } else if (status === 'rejected' || status === 'ended' || status === 'missed') {
        sounds.playHangupTone();
        setOutgoingCall(null);
      }
    });

    return () => unsub();
  }, [outgoingCall?.callId, currentUser?.id]);

  // Start outgoing call using Zego Call Invitation and Supabase Realtime
  const startCall = async (participant: User, type: 'audio' | 'video') => {
    if (!currentUser) return;

    // 1. Create call row in Supabase
    

    const activeCallId = `call_${Date.now()}`;

    // 2. Show outgoing ringing overlay using the real database UUID
    setOutgoingCall({
      callId: activeCallId,
      callee: participant,
      type
    });

    console.log('📱 [CallInitiated] Sending Zego Invitation to target:', {
      callId: activeCallId,
      targetId: participant.id,
      targetName: participant.name,
      type
    });

    // 3. Trigger Zego invitation in background
    await zegoCallService.sendCallInvitation(participant, type);
  };

  // Cancel outgoing call
  const cancelOutgoingCall = async () => {
    if (outgoingCall?.callId) {
      await supabaseService.updateCallStatus(outgoingCall.callId, 'rejected');
    }
    setOutgoingCall(null);
  };

  // Accept incoming call
  const acceptIncomingCall = async () => {
    if (!incomingCall || !currentUser) return;

    await supabaseService.updateCallStatus(incomingCall.callId, 'accepted');
    const roomId = incomingCall.callId;

    setActiveCall({
      id: incomingCall.callId,
      roomId,
      participant: incomingCall.caller,
      type: incomingCall.type,
      status: 'connected',
      isMuted: false,
      isVideoOff: false,
      isSpeakerOn: true,
      isScreenSharing: false,
      isFrontCamera: true,
      durationSeconds: 0,
      hasLocalVideo: true,
      hasRemoteVideo: true,
      signalQuality: 'excellent'
    });

    setIncomingCall(null);
  };

  // Decline incoming call
  const declineIncomingCall = async () => {
    if (incomingCall) {
      await supabaseService.updateCallStatus(incomingCall.callId, 'rejected');
    }
    setIncomingCall(null);
  };

  // End active call
  const endActiveCall = async () => {
    if (activeCall) {
      await supabaseService.updateCallStatus(activeCall.id, 'ended', activeCall.durationSeconds);
      setActiveCall(null);
    }
  };

  // Select user and start/open conversation
  const handleSelectUser = async (user: User) => {
    if (!currentUser) return;
    await supabaseService.ensureConversation(currentUser.id, user.id);
    setSelectedUser(user);
  };

  // Send real Supabase message
  const handleSendMessage = async (
    text: string,
    type: 'text' | 'audio' | 'image' | 'file' = 'text',
    mediaUrl?: string,
    fileName?: string,
    replyTo?: { id: string; text: string; senderName?: string }
  ): Promise<boolean> => {
    if (!selectedUser || !currentUser) return false;
    return await supabaseService.sendMessage(
      currentUser.id,
      selectedUser.id,
      text,
      type,
      mediaUrl,
      fileName,
      replyTo
    );
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedUser || !currentUser) return;
    const convId = await supabaseService.ensureConversation(currentUser.id, selectedUser.id);
    await supabaseService.deleteMessage(convId, messageId);
  };

  const missedCount = callLogs.filter((c) => c.direction === 'missed').length;

  if (!currentUser) {
    return (
      <FlutterPhoneFrame>
        <AuthModal currentUser={null} />
      </FlutterPhoneFrame>
    );
  }

  return (
    <FlutterPhoneFrame>
      {/* Active Video/Audio Call View */}
      {activeCall && (
        <CallScreen callState={activeCall} onEndCall={endActiveCall} />
      )}

      {/* Outgoing Ringing Screen */}
      {outgoingCall && (
        <OutgoingCallOverlay
          callee={outgoingCall.callee}
          type={outgoingCall.type}
          onCancel={cancelOutgoingCall}
        />
      )}

      {/* Incoming Call Popup Ring */}
      {incomingCall && (
        <IncomingCallOverlay
          caller={incomingCall.caller}
          type={incomingCall.type}
          onAccept={acceptIncomingCall}
          onDecline={declineIncomingCall}
        />
      )}

      {/* Main Flutter Navigation Framework */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        {!selectedUser && (
          <Header
            currentUser={currentUser}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {/* Dynamic Tab Body or Active Chat Detail */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {selectedUser ? (
            <ChatDetail
              currentUserId={currentUser.id}
              participant={selectedUser}
              messages={messages[selectedUser.id] || []}
              onBack={() => setSelectedUser(null)}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onStartCall={startCall}
            />
          ) : (
            <>
              {activeTab === 'chats' && (
                <ChatList
                  users={users}
                  conversations={conversations}
                  messages={messages}
                  onSelectUser={handleSelectUser}
                  onStartCall={startCall}
                  onNewChat={() => setShowNewChatModal(true)}
                />
              )}

              {activeTab === 'status' && (
                <StatusTab currentUser={currentUser} />
              )}

              {activeTab === 'calls' && (
                <CallList
                  callLogs={callLogs}
                  users={users}
                  onStartCall={startCall}
                  onNewCall={() => setShowNewChatModal(true)}
                />
              )}

              {activeTab === 'contacts' && (
                <ContactsList
                  currentUser={currentUser}
                  users={users}
                  onSelectUser={handleSelectUser}
                  onStartCall={startCall}
                  onRefreshUsers={refreshUsers}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsScreen
                  currentUser={currentUser}
                  onOpenAuth={() => setShowAuthModal(true)}
                  onOpenPrivacy={() => setShowPrivacyModal(true)}
                />
              )}
            </>
          )}
        </main>

        {/* Bottom Flutter Material 3 Navigation Bar */}
        {!selectedUser && (
          <BottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            unreadCount={0}
            missedCallCount={missedCount}
          />
        )}
      </div>

      {/* New Chat User Selection Modal */}
      {showNewChatModal && (
        <NewChatModal
          users={users}
          onSelectUser={handleSelectUser}
          onClose={() => setShowNewChatModal(false)}
        />
      )}

      {/* Supabase Auth Modal */}
      {showAuthModal && (
        <AuthModal
          currentUser={currentUser}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Privacy Settings Modal */}
      {showPrivacyModal && (
        <PrivacyModal
          currentUser={currentUser}
          users={users}
          onClose={() => setShowPrivacyModal(false)}
          onUpdateUserPrivacy={refreshUsers}
        />
      )}
    </FlutterPhoneFrame>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

