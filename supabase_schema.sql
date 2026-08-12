-- ========================================================
-- SNNS SUPABASE DATABASE SCHEMA AND RLS POLICIES
-- Clean, modern, secure database definition for SNNS
-- High performance messaging, calls, status & profile management
-- ========================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. PROFILES TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    bio TEXT DEFAULT 'Available on SNNS',
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'contacts')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT 
    USING (
        profile_visibility = 'public' 
        OR auth.uid() = id
        OR (profile_visibility = 'contacts' AND auth.uid() IS NOT NULL)
    );

CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- --------------------------------------------------------
-- 2. CONVERSATIONS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_group BOOLEAN DEFAULT false,
    group_name TEXT,
    group_avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 3. CONVERSATION MEMBERS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of conversations they belong to"
    ON public.conversation_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = conversation_members.conversation_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view conversations they are member of"
    ON public.conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = conversations.id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can add members to conversations"
    ON public.conversation_members FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 4. MESSAGES TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'file', 'call_log')),
    media_url TEXT,
    file_name TEXT,
    file_size INT,
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = messages.conversation_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages into their conversations"
    ON public.messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = messages.conversation_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own messages"
    ON public.messages FOR DELETE
    USING (auth.uid() = sender_id);

-- --------------------------------------------------------
-- 5. MESSAGE READS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert read markers"
    ON public.message_reads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view read receipts for their conversations"
    ON public.message_reads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
            WHERE m.id = message_reads.message_id
            AND cm.user_id = auth.uid()
        )
    );

-- --------------------------------------------------------
-- 6. CALLS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    room_id TEXT,
    channel_id TEXT,
    type TEXT DEFAULT 'video' CHECK (type IN ('audio', 'video')),
    call_type TEXT DEFAULT 'video' CHECK (call_type IN ('audio', 'video')),
    status TEXT DEFAULT 'ringing' CHECK (status IN ('dialing', 'ringing', 'accepted', 'connected', 'rejected', 'busy', 'ended', 'missed', 'failed')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INT DEFAULT 0
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calls they participate in"
    ON public.calls FOR SELECT
    USING (
        auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = callee_id
    );

CREATE POLICY "Users can create calls"
    ON public.calls FOR INSERT
    WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their calls"
    ON public.calls FOR UPDATE
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = callee_id);

CREATE POLICY "Participants can view call entries"
    ON public.call_participants FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.calls c
            WHERE c.id = call_participants.call_id AND c.caller_id = auth.uid()
        )
    );

CREATE POLICY "Users can add call participants"
    ON public.call_participants FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- --------------------------------------------------------
-- 8. STATUSES (STORIES) TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    caption TEXT,
    type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video', 'text')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active statuses are viewable by authenticated users"
    ON public.statuses FOR SELECT
    USING (expires_at > NOW() AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own status"
    ON public.statuses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own status"
    ON public.statuses FOR DELETE
    USING (auth.uid() = user_id);

-- --------------------------------------------------------
-- 9. STATUS VIEWS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.status_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_id UUID REFERENCES public.statuses(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(status_id, viewer_id)
);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Status view records are insertable by viewer"
    ON public.status_views FOR INSERT
    WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Status owners can see who viewed their status"
    ON public.status_views FOR SELECT
    USING (
        viewer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.statuses s
            WHERE s.id = status_views.status_id AND s.user_id = auth.uid()
        )
    );

-- --------------------------------------------------------
-- 10. BLOCKED USERS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their block list"
    ON public.blocked_users FOR ALL
    USING (auth.uid() = blocker_id);

-- --------------------------------------------------------
-- 11. REPORTS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

-- --------------------------------------------------------
-- 12. NOTIFICATIONS TABLE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- --------------------------------------------------------
-- AUTOMATIC PROFILE TRIGGER ON SIGNUP
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, avatar_url, created_at)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.email,
        COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
