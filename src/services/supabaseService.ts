import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Message, CallLog, PrivacySettings, UserStatus } from '../types';

export interface DiagnosticsInfo {
  authStatus: 'Connected' | 'Failed';
  dbStatus: 'Connected' | 'Failed' | 'Testing...';
  realtimeStatus: 'SUBSCRIBED' | 'Connecting' | 'Failed';
  lastInsertStatus: 'Success' | 'Failed' | 'None';
  lastReceivedStatus: 'Success' | 'None';
  lastConversationId?: string;
  lastSenderId?: string;
  lastReceiverId?: string;
  // Calls Diagnostics
  callsRealtimeStatus: 'SUBSCRIBED' | 'Connecting' | 'Failed';
  edgeFunctionTokenStatus: 'Success' | 'Failed' | 'Not Tested';
  zegoSdkStatus: 'Ready' | 'Failed' | 'Initializing' | 'Idle';
  cameraPermission: 'Granted' | 'Denied' | 'Not Requested';
  microphonePermission: 'Granted' | 'Denied' | 'Not Requested';
  currentCallId?: string;
  currentRoomId?: string;
  callStatus: 'Idle' | 'Dialing' | 'Ringing' | 'Accepted' | 'Connected' | 'Rejected' | 'Ended' | 'Missed' | 'Failed';
  joinedRoom: boolean;
  localStreamPublished: boolean;
  remoteStreamReceived: boolean;
  lastCallError?: string;
}

class DiagnosticsManager {
  private info: DiagnosticsInfo = {
    authStatus: 'Connected',
    dbStatus: 'Testing...',
    realtimeStatus: 'Connecting',
    lastInsertStatus: 'None',
    lastReceivedStatus: 'None',
    callsRealtimeStatus: 'Connecting',
    edgeFunctionTokenStatus: 'Not Tested',
    zegoSdkStatus: 'Initializing',
    cameraPermission: 'Not Requested',
    microphonePermission: 'Not Requested',
    callStatus: 'Idle',
    joinedRoom: false,
    localStreamPublished: false,
    remoteStreamReceived: false
  };

  private listeners = new Set<(info: DiagnosticsInfo) => void>();

  getDiagnostics(): DiagnosticsInfo {
    return { ...this.info };
  }

  update(partial: Partial<DiagnosticsInfo>) {
    this.info = { ...this.info, ...partial };
    this.listeners.forEach((l) => l(this.info));
  }

  subscribe(listener: (info: DiagnosticsInfo) => void) {
    this.listeners.add(listener);
    listener(this.info);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async runHealthCheck(currentUserId?: string) {
    if (!isSupabaseConfigured) {
      this.update({ authStatus: 'Failed', dbStatus: 'Failed', realtimeStatus: 'Failed' });
      return;
    }

    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        this.update({ dbStatus: 'Failed' });
      } else {
        this.update({ dbStatus: 'Connected' });
      }
    } catch {
      this.update({ dbStatus: 'Failed' });
    }

    if (currentUserId) {
      this.update({ authStatus: 'Connected' });
    } else {
      this.update({ authStatus: 'Failed' });
    }
  }
}

export const diagnosticsManager = new DiagnosticsManager();

export function toUuidOrText(uid: string): string {
  if (!uid) return '00000000-0000-0000-0000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(uid)) return uid;

  let hex = '';
  for (let i = 0; i < uid.length; i++) {
    hex += uid.charCodeAt(i).toString(16);
  }
  hex = (hex + '00000000000000000000000000000000').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(12, 15)}-a${hex.slice(15, 18)}-${hex.slice(18, 30)}`;
}

export class SupabaseService {
  // Sync the authenticated Supabase user into public.profiles.
  async syncUserProfileFromAuth(sbUser: any): Promise<void> {
    if (!isSupabaseConfigured || !sbUser?.id) return;

    const metadata = sbUser.user_metadata || {};
    const now = new Date().toISOString();
    const payload = {
      id: sbUser.id,
      full_name: metadata.full_name || metadata.name || sbUser.email?.split('@')[0] || 'مستخدم',
      email: sbUser.email || null,
      avatar_url: metadata.avatar_url || metadata.picture || null,
      language: 'ar',
      profile_visibility: 'public',
      is_online: true,
      last_seen: now,
      updated_at: now
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) console.error('PROFILE_SYNC_ERROR', error);
  }

  // Helper for localStorage state fallback
  private getLocalFollows(userId: string): string[] {
    try {
      const data = localStorage.getItem(`follows_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  private setLocalFollows(userId: string, follows: string[]) {
    try {
      localStorage.setItem(`follows_${userId}`, JSON.stringify(follows));
    } catch (e) {}
  }

  private getLocalFollowers(userId: string): string[] {
    try {
      const data = localStorage.getItem(`followers_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  private setLocalFollowers(userId: string, followers: string[]) {
    try {
      localStorage.setItem(`followers_${userId}`, JSON.stringify(followers));
    } catch (e) {}
  }

  getLocalPrivacy(userId: string): PrivacySettings {
    const defaultPrivacy: PrivacySettings = {
      lastSeenVisibility: 'everyone',
      hideOnlineStatus: false,
      readReceipts: true,
      profilePhotoVisibility: 'everyone',
      allowCallFrom: 'everyone',
      blockedUserIds: []
    };
    try {
      const data = localStorage.getItem(`privacy_${userId}`);
      return data ? { ...defaultPrivacy, ...JSON.parse(data) } : defaultPrivacy;
    } catch (e) {
      return defaultPrivacy;
    }
  }

  setLocalPrivacy(userId: string, settings: PrivacySettings) {
    try {
      localStorage.setItem(`privacy_${userId}`, JSON.stringify(settings));
    } catch (e) {}
  }

  // Toggle Follow / Unfollow user
  async toggleFollow(currentUserId: string, targetUserId: string): Promise<boolean> {
    const following = this.getLocalFollows(currentUserId);
    const targetFollowers = this.getLocalFollowers(targetUserId);
    const isFollowing = following.includes(targetUserId);

    let nextFollowing: string[];
    let nextTargetFollowers: string[];

    if (isFollowing) {
      nextFollowing = following.filter((id) => id !== targetUserId);
      nextTargetFollowers = targetFollowers.filter((id) => id !== currentUserId);
    } else {
      nextFollowing = [...following, targetUserId];
      nextTargetFollowers = [...targetFollowers, currentUserId];
    }

    this.setLocalFollows(currentUserId, nextFollowing);
    this.setLocalFollowers(targetUserId, nextTargetFollowers);

    // Sync to Supabase if table exists
    if (isSupabaseConfigured) {
      try {
        if (isFollowing) {
          await supabase.from('follows').delete().match({ follower_id: currentUserId, followed_id: targetUserId });
        } else {
          await supabase.from('follows').upsert({ follower_id: currentUserId, followed_id: targetUserId }, { onConflict: 'follower_id,followed_id' });
        }
      } catch (err) {
        // Fallback handled silently
      }
    }

    return !isFollowing;
  }

  // Toggle Block / Unblock user
  async toggleBlockUser(currentUserId: string, targetUserId: string): Promise<boolean> {
    const privacy = this.getLocalPrivacy(currentUserId);
    const isBlocked = privacy.blockedUserIds.includes(targetUserId);

    const nextBlocked = isBlocked
      ? privacy.blockedUserIds.filter((id) => id !== targetUserId)
      : [...privacy.blockedUserIds, targetUserId];

    const updatedPrivacy = { ...privacy, blockedUserIds: nextBlocked };
    this.setLocalPrivacy(currentUserId, updatedPrivacy);

    if (isSupabaseConfigured) {
      try {
        if (isBlocked) {
          await supabase.from('blocked_users').delete().match({ blocker_id: currentUserId, blocked_id: targetUserId });
        } else {
          await supabase.from('blocked_users').upsert({ blocker_id: currentUserId, blocked_id: targetUserId }, { onConflict: 'blocker_id,blocked_id' });
        }
      } catch (e) {}
    }

    return !isBlocked;
  }

  // Update privacy settings
  async updatePrivacySettings(currentUserId: string, settings: PrivacySettings): Promise<void> {
    this.setLocalPrivacy(currentUserId, settings);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('user_privacy').upsert({
          user_id: currentUserId,
          settings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      } catch (e) {}
    }
  }

  // Sync an application User into public.profiles using the Supabase Auth UUID.
  async syncUserProfile(user: User, _idToken?: string): Promise<void> {
    if (!isSupabaseConfigured || !user?.id) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.name,
      email: user.email || null,
      avatar_url: user.avatar || null,
      phone: user.phone || null,
      language: user.language || 'ar',
      profile_visibility: 'public',
      is_online: true,
      last_seen: now,
      updated_at: now
    }, { onConflict: 'id' });
    if (error) console.error('PROFILE_SYNC_ERROR', error);
  }

  async setUserPresence(userId: string, isOnline: boolean): Promise<void> {
    if (!isSupabaseConfigured || !userId) return;
    const { error } = await supabase.from('profiles').update({
      is_online: isOnline,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', userId);
    if (error) console.warn('PRESENCE_UPDATE_ERROR', error);
  }

  subscribeUsers(currentUserId: string, callback: (users: User[]) => void): () => void {
    if (!isSupabaseConfigured) {
      callback([]);
      return () => {};
    }

    const fetchUsers = async () => {
      const { data, error } = await supabase.from('profiles').select('*').neq('id', currentUserId);
      if (error) {
        console.error('PROFILES_FETCH_ERROR', error);
        callback([]);
        return;
      }

      const myFollowing = this.getLocalFollows(currentUserId);
      const myPrivacy = this.getLocalPrivacy(currentUserId);
      const users = (data || []).map((p: any): User => {
        const privacy = this.getLocalPrivacy(p.id);
        const followed = myFollowing.includes(p.id);
        let online = Boolean(p.is_online);
        if (privacy.hideOnlineStatus) online = false;
        let lastSeen = p.last_seen ? new Date(p.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'غير متصل';
        if (privacy.lastSeenVisibility === 'nobody') lastSeen = 'مخفي';
        if (privacy.lastSeenVisibility === 'followers' && !followed) lastSeen = 'للمتابعين فقط';
        return {
          id: p.id,
          name: p.full_name || p.email?.split('@')[0] || 'مستخدم',
          avatar: p.avatar_url || '',
          email: p.email || undefined,
          phone: p.phone || undefined,
          language: p.language || 'ar',
          isOnline: online,
          lastSeen,
          statusText: p.status_text || (online ? 'متصل الآن' : lastSeen),
          followersCount: this.getLocalFollowers(p.id).length,
          followingCount: this.getLocalFollows(p.id).length,
          isFollowedByMe: followed,
          privacySettings: privacy
        };
      }).filter((u: User) => !myPrivacy.blockedUserIds.includes(u.id));
      callback(users);
    };

    void fetchUsers();
    const channel = supabase.channel(`profiles_${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }

  // Get or ensure conversation UUID for two users
  async getConversationId(userId1: string, userId2: string): Promise<string> {
    return await this.ensureConversation(userId1, userId2);
  }

  // Upload file or blob to Supabase Storage ('chat-media' bucket) and return Signed URL or storage path
  async uploadAttachment(fileOrBlob: File | Blob, fileName: string, contentType?: string): Promise<{ storagePath: string; url: string } | null> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase client not configured for file upload');
      return null;
    }

    try {
      const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
      const { data: authData } = await supabase.auth.getUser();
      const ownerId = authData.user?.id;
      if (!ownerId) throw new Error('انتهت الجلسة، سجل الدخول مجددًا');
      const filePath = `${ownerId}/${cleanFileName}`;
      const mimeType = contentType || fileOrBlob.type || 'application/octet-stream';

      // 1. Try 'chat-media' bucket
      let targetBucket = 'chat-media';
      let { data, error } = await supabase.storage
        .from(targetBucket)
        .upload(filePath, fileOrBlob, {
          contentType: mimeType,
          upsert: true
        });

      // 2. If 'chat-media' bucket fails, try 'attachments' or 'media'
      if (error) {
        console.warn('Upload to chat-media bucket error:', error.message);
        targetBucket = 'attachments';
        const res2 = await supabase.storage
          .from(targetBucket)
          .upload(filePath, fileOrBlob, {
            contentType: mimeType,
            upsert: true
          });
        data = res2.data;
        error = res2.error;

        if (error) {
          targetBucket = 'media';
          const res3 = await supabase.storage
            .from(targetBucket)
            .upload(filePath, fileOrBlob, {
              contentType: mimeType,
              upsert: true
            });
          data = res3.data;
          error = res3.error;
        }
      }

      if (error || !data) {
        console.error('Supabase Storage upload failed:', error?.message || 'Unknown error');
        return null;
      }

      // Generate Signed URL for private bucket access (24 hour validity)
      const { data: signedData, error: signedError } = await supabase.storage
        .from(targetBucket)
        .createSignedUrl(filePath, 86400);

      if (signedError || !signedData?.signedUrl) {
        // Fallback to public URL if bucket is public
        const { data: publicData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
        if (publicData?.publicUrl) {
          return { storagePath: `${targetBucket}:${filePath}`, url: publicData.publicUrl };
        }
        return null;
      }

      return { storagePath: `${targetBucket}:${filePath}`, url: signedData.signedUrl };
    } catch (err: any) {
      console.error('Exception during Supabase Storage upload:', err?.message || err);
      return null;
    }
  }

  // Get refreshed Signed URL for storage path or media URL
  async getSignedUrl(storagePathOrUrl: string): Promise<string> {
    if (!storagePathOrUrl) return '';
    if (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://')) {
      return storagePathOrUrl;
    }

    try {
      let bucket = 'chat-media';
      let path = storagePathOrUrl;

      if (storagePathOrUrl.includes(':')) {
        const parts = storagePathOrUrl.split(':');
        bucket = parts[0];
        path = parts[1];
      }

      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 86400);
      if (data?.signedUrl) return data.signedUrl;
    } catch (e) {
      // fallback
    }

    return storagePathOrUrl;
  }

  // Ensure one direct conversation exists. Creation is performed by a SECURITY DEFINER RPC.
  async ensureConversation(currentUserId: string, otherUserId: string): Promise<string> {
    if (!isSupabaseConfigured) throw new Error('Supabase غير مهيأ');
    if (!currentUserId || !otherUserId || currentUserId === otherUserId) {
      throw new Error('معرفات المحادثة غير صحيحة');
    }

    const { data, error } = await supabase.rpc('create_direct_conversation', {
      other_user_id: otherUserId
    });
    if (error) {
      console.error('CREATE_DIRECT_CONVERSATION_ERROR', error);
      throw new Error(error.message);
    }
    if (typeof data !== 'string' || !data) throw new Error('لم يتم إرجاع معرف المحادثة');
    diagnosticsManager.update({ lastConversationId: data });
    return data;
  }

  subscribeConversations(
    currentUserId: string,
    callback: (conversations: Array<{ id: string; otherUserId: string; lastMessage: string; lastMessageTime: string }>) => void
  ): () => void {
    if (!isSupabaseConfigured) { callback([]); return () => {}; }

    const fetchConversations = async () => {
      const { data: memberships, error: memberError } = await supabase
        .from('conversation_members').select('conversation_id').eq('user_id', currentUserId);
      if (memberError) { console.error('CONVERSATION_MEMBERS_FETCH_ERROR', memberError); return; }
      const ids = Array.from(new Set<string>((memberships || []).map((r: any) => String(r.conversation_id))));
      if (!ids.length) { callback([]); return; }

      const { data: allMembers, error: allMembersError } = await supabase
        .from('conversation_members').select('conversation_id,user_id').in('conversation_id', ids);
      if (allMembersError) { console.error('CONVERSATION_MEMBER_LIST_ERROR', allMembersError); return; }

      const { data: latestMessages, error: msgError } = await supabase
        .from('messages').select('conversation_id,body,type,created_at').in('conversation_id', ids)
        .order('created_at', { ascending: false });
      if (msgError) console.error('CONVERSATION_SUMMARY_ERROR', msgError);

      const firstByConversation = new Map<string, any>();
      for (const row of latestMessages || []) if (!firstByConversation.has(row.conversation_id)) firstByConversation.set(row.conversation_id, row);
      const rows = ids.map((id) => {
        const members = (allMembers || []).filter((m: any) => m.conversation_id === id);
        const otherUserId = members.find((m: any) => m.user_id !== currentUserId)?.user_id || currentUserId;
        const last = firstByConversation.get(id);
        const label = !last ? '' : last.type === 'image' ? '📷 صورة' : last.type === 'audio' ? '🎤 تسجيل صوتي' : last.type === 'file' ? '📁 ملف' : (last.body || '');
        return {
          id,
          otherUserId,
          lastMessage: label,
          lastMessageTime: last?.created_at ? new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
        };
      });
      callback(rows);
    };

    void fetchConversations();
    const channel = supabase.channel(`conversation_list_${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchConversations)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }

  subscribeMessages(conversationId: string, callback: (messages: Message[]) => void): () => void {
    if (!isSupabaseConfigured || !conversationId) { callback([]); return () => {}; }

    const fetchMessages = async () => {
      const { data, error } = await supabase.from('messages').select('*')
        .eq('conversation_id', conversationId).eq('is_deleted', false)
        .order('created_at', { ascending: true });
      if (error) { console.error('MESSAGES_FETCH_ERROR', error); diagnosticsManager.update({ dbStatus: 'Failed' }); return; }
      const rows: Message[] = (data || []).map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        receiverId: '',
        text: m.body || '',
        timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: m.type || 'text',
        mediaUrl: m.media_url || undefined,
        fileName: m.file_name || undefined,
        replyTo: m.reply_to ? { id: m.reply_to, text: '' } : undefined,
        isRead: Boolean(m.is_read),
        isDelivered: Boolean(m.is_delivered),
        originalLang: 'ar'
      }));
      callback(rows);
      diagnosticsManager.update({ dbStatus: 'Connected' });
    };

    void fetchMessages();
    const channel = supabase.channel(`messages_${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, fetchMessages)
      .subscribe((status) => diagnosticsManager.update({ realtimeStatus: status === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'Connecting' }));
    return () => { void supabase.removeChannel(channel); };
  }

  async sendMessage(
    senderId: string,
    receiverId: string,
    text: string,
    type: 'text' | 'audio' | 'image' | 'file' = 'text',
    mediaUrl?: string,
    fileName?: string,
    replyTo?: { id: string; text: string; senderName?: string }
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const conversationId = await this.ensureConversation(senderId, receiverId);
      const payload = {
        conversation_id: conversationId,
        sender_id: senderId,
        type,
        body: text || '',
        media_url: mediaUrl || null,
        file_name: fileName || null,
        reply_to: replyTo?.id || null,
        is_forwarded: false,
        is_edited: false,
        is_deleted: false,
        is_delivered: true,
        is_read: false
      };
      const { error } = await supabase.from('messages').insert(payload);
      if (error) { console.error('MESSAGE_INSERT_ERROR', error, payload); diagnosticsManager.update({ lastInsertStatus: 'Failed' }); return false; }
      diagnosticsManager.update({ lastInsertStatus: 'Success', lastConversationId: conversationId, lastSenderId: senderId, lastReceiverId: receiverId });
      return true;
    } catch (error) {
      console.error('SEND_MESSAGE_ERROR', error);
      diagnosticsManager.update({ lastInsertStatus: 'Failed' });
      return false;
    }
  }

  // Delete message
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.from('messages').delete().eq('id', messageId);
    } catch (err) {
      console.error('Failed to delete message in Supabase:', err);
    }
  }

  // Calls use the live table shape: conversation_id, room_name, caller_id, callee_id, call_type, type, status, started_at.
  subscribeCallLogs(currentUserId: string, callback: (calls: CallLog[]) => void): () => void {
    if (!isSupabaseConfigured) { callback([]); return () => {}; }
    const fetchCalls = async () => {
      const { data, error } = await supabase.from('calls').select('*')
        .or(`caller_id.eq.${currentUserId},callee_id.eq.${currentUserId}`)
        .order('started_at', { ascending: false });
      if (error) { console.error('CALL_LOGS_FETCH_ERROR', error); return; }
      callback((data || []).map((c: any) => ({
        id: c.id,
        participantId: c.caller_id === currentUserId ? c.callee_id : c.caller_id,
        type: (c.call_type || c.type || 'video') as 'audio' | 'video',
        direction: c.caller_id === currentUserId ? 'outgoing' : (c.status === 'missed' || c.status === 'rejected' ? 'missed' : 'incoming'),
        timestamp: new Date(c.started_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        zegoRoomId: c.room_name || c.id
      })));
    };
    void fetchCalls();
    const channel = supabase.channel(`calls_${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, fetchCalls).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }

  async createCallRecord(params: {
    id?: string;
    caller_id: string;
    receiver_id: string;
    type: 'audio' | 'video';
    status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended';
    roomId?: string;
  }): Promise<string | null> {
    if (!isSupabaseConfigured) {
      console.error('CALL_RECORD_ERROR: Supabase غير مهيأ');
      return null;
    }

    if (!params.caller_id || !params.receiver_id) {
      console.error('CALL_RECORD_ERROR: معرف المتصل أو المستقبل غير موجود');
      return null;
    }

    const callId = (params.id && /^[0-9a-f-]{36}$/i.test(params.id)) ? params.id : crypto.randomUUID();
    const roomName = params.roomId?.trim() || `call_${Date.now()}_${callId.slice(0, 8)}`;

    const payload = {
      id: callId,
      conversation_id: callId,
      room_name: roomName,
      caller_id: params.caller_id,
      callee_id: params.receiver_id,
      call_type: params.type,
      type: params.type,
      status: params.status,
      started_at: new Date().toISOString()
    };

    console.log('CALL_RECORD_PAYLOAD', payload);

    const { data, error } = await supabase
      .from('calls')
      .upsert(payload, { onConflict: 'id' })
      .select('id, room_name, status')
      .single();

    if (error) {
      console.error('CALL_RECORD_ERROR', error, payload);
      diagnosticsManager.update({
        callStatus: 'Failed',
        lastCallError: error.message
      });
      return null;
    }

    if (!data?.id) {
      console.error('CALL_RECORD_ERROR: لم يرجع Supabase معرف المكالمة');
      return null;
    }

    diagnosticsManager.update({
      currentCallId: data.id,
      currentRoomId: data.room_name || roomName,
      callStatus: 'Ringing'
    });

    console.log('CALL_RECORD_CREATED', {
      callId: data.id,
      roomName: data.room_name || roomName
    });

    return data.id;
  }

  async createCall(
    callerId: string,
    receiverId: string,
    type: 'audio' | 'video'
  ): Promise<string | null> {
    return this.createCallRecord({
      caller_id: callerId,
      receiver_id: receiverId,
      type,
      status: 'ringing'
    });
  }

  subscribeIncomingCalls(
    currentUserId: string,
    callback: (call: {
      callId: string;
      callerId: string;
      type: 'audio' | 'video';
      channelId: string;
      roomId: string;
    } | null) => void
  ): () => void {
    if (!isSupabaseConfigured || !currentUserId) {
      callback(null);
      return () => {};
    }

    const fetchIncoming = async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('id, conversation_id, room_name, caller_id, callee_id, call_type, type, status, started_at')
        .eq('callee_id', currentUserId)
        .eq('status', 'ringing')
        .order('started_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('INCOMING_CALL_FETCH_ERROR', error);
        return;
      }

      const callRow = data?.[0];
      if (!callRow) {
        callback(null);
        return;
      }

      callback({
        callId: callRow.id,
        callerId: callRow.caller_id,
        type: (callRow.call_type || callRow.type || 'video') as 'audio' | 'video',
        channelId: callRow.room_name,
        roomId: callRow.room_name
      });
    };

    void fetchIncoming();

    const channel = supabase
      .channel(`incoming_calls_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${currentUserId}`
        },
        () => {
          void fetchIncoming();
        }
      )
      .subscribe((status) => {
        diagnosticsManager.update({
          callsRealtimeStatus: status === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'Connecting'
        });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }

  subscribeCallStatus(
    callId: string,
    callback: (status: string) => void
  ): () => void {
    if (!isSupabaseConfigured || !callId) return () => {};

    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('id, status, room_name')
        .eq('id', callId)
        .maybeSingle();

      if (error) {
        console.error('CALL_STATUS_FETCH_ERROR', error);
        return;
      }

      if (data?.status) {
        callback(data.status);
        diagnosticsManager.update({
          currentCallId: data.id,
          currentRoomId: data.room_name || undefined,
          callStatus: this.mapDatabaseCallStatus(data.status)
        });
      }
    };

    void fetchStatus();

    const channel = supabase
      .channel(`call_status_${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${callId}`
        },
        (payload: any) => {
          const status = payload.new?.status;
          if (status) {
            callback(status);
            diagnosticsManager.update({
              currentCallId: payload.new?.id || callId,
              currentRoomId: payload.new?.room_name || undefined,
              callStatus: this.mapDatabaseCallStatus(status)
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }

  async updateCallStatus(
    callId: string,
    status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed',
    _durationSec?: number
  ): Promise<void> {
    if (!isSupabaseConfigured || !callId) return;

    const { error } = await supabase
      .from('calls')
      .update({ status })
      .eq('id', callId);

    if (error) {
      console.error('CALL_STATUS_UPDATE_ERROR', error, { callId, status });
      return;
    }

    diagnosticsManager.update({
      currentCallId: callId,
      callStatus: this.mapDatabaseCallStatus(status)
    });
  }

  private mapDatabaseCallStatus(status: string): DiagnosticsInfo['callStatus'] {
    switch (status) {
      case 'ringing': return 'Ringing';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      case 'missed': return 'Missed';
      case 'ended': return 'Ended';
      case 'failed': return 'Failed';
      default: return 'Idle';
    }
  }

  // --- USER STATUSES (24-Hour Disappearing Stories) ---
  getLocalStatuses(): UserStatus[] {
    try {
      const stored = localStorage.getItem('snns_user_statuses');
      if (stored) {
        const parsed: UserStatus[] = JSON.parse(stored);
        const now = new Date().getTime();
        return parsed.filter(s => new Date(s.expiresAt).getTime() > now);
      }
    } catch (e) {
      console.warn('Error reading local statuses:', e);
    }

    return [];
  }

  async fetchActiveStatuses(): Promise<UserStatus[]> {
    let statuses = this.getLocalStatuses();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('user_statuses')
          .select('*')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const dbStatuses: UserStatus[] = data.map(d => ({
            id: d.id,
            userId: d.user_id,
            userName: d.user_name || 'User',
            userAvatar: d.user_avatar || '',
            text: d.text || '',
            bgColor: d.bg_color || 'from-cyan-600 to-slate-900',
            mediaUrl: d.media_url,
            createdAt: d.created_at,
            expiresAt: d.expires_at,
            viewsCount: d.views_count || 0
          }));
          // Merge with local statuses by unique ID
          const statusMap = new Map<string, UserStatus>();
          statuses.forEach(s => statusMap.set(s.id, s));
          dbStatuses.forEach(s => statusMap.set(s.id, s));
          statuses = Array.from(statusMap.values());
        }
      } catch (err) {
        console.warn('Using local fallback for statuses:', err);
      }
    }

    // Sort newest first
    return statuses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createStatus(params: {
    userId: string;
    userName: string;
    userAvatar: string;
    text: string;
    bgColor?: string;
    mediaUrl?: string;
  }): Promise<UserStatus> {
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const newStatus: UserStatus = {
      id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: params.userId,
      userName: params.userName,
      userAvatar: params.userAvatar,
      text: params.text,
      bgColor: params.bgColor || 'from-cyan-600 to-slate-900',
      mediaUrl: params.mediaUrl,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      viewsCount: 0
    };

    // Save locally
    const existing = this.getLocalStatuses();
    const updated = [newStatus, ...existing];
    try {
      localStorage.setItem('snns_user_statuses', JSON.stringify(updated));
    } catch (e) {}

    // Save to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from('user_statuses').insert({
          id: newStatus.id,
          user_id: newStatus.userId,
          user_name: newStatus.userName,
          user_avatar: newStatus.userAvatar,
          text: newStatus.text,
          bg_color: newStatus.bgColor,
          media_url: newStatus.mediaUrl,
          created_at: newStatus.createdAt,
          expires_at: newStatus.expiresAt
        });
      } catch (err) {
        console.warn('Failed to insert status to Supabase, saved locally:', err);
      }
    }

    return newStatus;
  }

  async uploadStatusImage(file: File): Promise<string> {
    if (isSupabaseConfigured) {
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `status_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        
        // Attempt upload to Supabase Storage bucket 'status-media' or 'attachments'
        const { data, error } = await supabase.storage
          .from('status-media')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage
            .from('status-media')
            .getPublicUrl(data.path);
          if (publicUrlData?.publicUrl) {
            return publicUrlData.publicUrl;
          }
        } else {
          // If 'status-media' bucket doesn't exist, try 'attachments' bucket
          const { data: attData, error: attError } = await supabase.storage
            .from('attachments')
            .upload(fileName, file, { upsert: true });

          if (!attError && attData) {
            const { data: attPublicUrlData } = supabase.storage
              .from('attachments')
              .getPublicUrl(attData.path);
            if (attPublicUrlData?.publicUrl) {
              return attPublicUrlData.publicUrl;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase storage status upload failed, falling back to DataURL:', err);
      }
    }

    // Fallback to FileReader DataURL for local mode or if storage bucket is unavailable
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async deleteStatus(statusId: string): Promise<void> {
    const existing = this.getLocalStatuses();
    const filtered = existing.filter(s => s.id !== statusId);
    try {
      localStorage.setItem('snns_user_statuses', JSON.stringify(filtered));
    } catch (e) {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from('user_statuses').delete().eq('id', statusId);
      } catch (err) {
        console.warn('Failed to delete status in Supabase:', err);
      }
    }
  }
}

export const supabaseService = new SupabaseService();