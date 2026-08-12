import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZIM } from 'zego-zim-web';

import type { User } from '../types';
import { supabase } from '../lib/supabase';
import {
  diagnosticsManager,
  supabaseService,
} from './supabaseService';

type CallType = 'audio' | 'video';

type TargetProfile = {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
};

type IncomingCallData = {
  callID: string;
  caller: {
    userID: string;
    userName: string;
  };
  callType: number;
};

type CallListeners = {
  onIncomingCall?: (data: IncomingCallData) => void;
  onCallEnded?: () => void;
  onCallAccepted?: () => void;
};

type InvitationResult = {
  errorInvitees?: Array<{
    userID: string;
    userName?: string;
  }>;
};

export class ZegoCallService {
  private zpInstance: any = null;

  private currentUserId: string | null = null;

  private currentUserName: string | null = null;

  private isInitialized = false;

  private initializationPromise: Promise<void> | null = null;

  private onIncomingCallHandler:
    | ((data: IncomingCallData) => void)
    | null = null;

  private onCallEndedHandler: (() => void) | null = null;

  private onCallAcceptedHandler: (() => void) | null = null;

  /**
   * قراءة App ID الخاص بـ ZEGOCLOUD من متغيرات Vite.
   */
  public getAppId(): number {
    const rawValue = import.meta.env.VITE_ZEGO_APP_ID;

    if (rawValue) {
      const appId = Number(rawValue);
      if (Number.isInteger(appId) && appId > 0) {
        return appId;
      }
    }

    return 366567418;
  }

  /**
   * طلب صلاحية الكاميرا والميكروفون قبل إرسال المكالمة.
   * يتم إيقاف Stream التجريبي مباشرة بعد التحقق حتى لا تبقى
   * الكاميرا أو الميكروفون محجوزين.
   */
  public async requestMediaPermissions(
    type: CallType,
  ): Promise<{
    success: boolean;
    errorMessage?: string;
  }> {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message =
        'المتصفح لا يدعم الوصول إلى الكاميرا والميكروفون.';

      diagnosticsManager.update({
        microphonePermission: 'Denied',
        cameraPermission:
          type === 'video' ? 'Denied' : 'Not Requested',
        lastCallError: message,
      });

      return {
        success: false,
        errorMessage: message,
      };
    }

    let stream: MediaStream | null = null;

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video:
          type === 'video'
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
              }
            : false,
      };

      stream =
        await navigator.mediaDevices.getUserMedia(
          constraints,
        );

      diagnosticsManager.update({
        microphonePermission: 'Granted',
        cameraPermission:
          type === 'video'
            ? 'Granted'
            : 'Not Requested',
      });

      return { success: true };
    } catch (error: unknown) {
      const mediaError =
        error instanceof DOMException
          ? error
          : null;

      let message =
        'تعذر الوصول إلى الكاميرا أو الميكروفون.';

      switch (mediaError?.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          message =
            'تم رفض استخدام الكاميرا أو الميكروفون. فعّل الصلاحية من إعدادات المتصفح.';
          break;

        case 'NotFoundError':
        case 'DevicesNotFoundError':
          message =
            'لم يتم العثور على كاميرا أو ميكروفون متصل بالجهاز.';
          break;

        case 'NotReadableError':
        case 'TrackStartError':
          message =
            'الكاميرا أو الميكروفون مستخدم حاليًا بواسطة تطبيق آخر.';
          break;

        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          message =
            'إعدادات الكاميرا المطلوبة غير مدعومة على هذا الجهاز.';
          break;

        case 'SecurityError':
          message =
            'يجب فتح الموقع من خلال HTTPS للسماح باستخدام الكاميرا والميكروفون.';
          break;

        default:
          break;
      }

      console.error(
        'ZEGO_MEDIA_PERMISSION_ERROR:',
        error,
      );

      diagnosticsManager.update({
        microphonePermission: 'Denied',
        cameraPermission:
          type === 'video'
            ? 'Denied'
            : 'Not Requested',
        lastCallError: message,
      });

      return {
        success: false,
        errorMessage: message,
      };
    } finally {
      stream
        ?.getTracks()
        .forEach((track) => track.stop());
    }
  }

  /**
   * طلب Token04 من Supabase Edge Function وإعادة KitToken للإنتاج.
   */
  private async getProductionKitToken(
    roomId: string,
    userId: string,
    userName: string,
  ): Promise<string> {
    const normalizedRoomId = roomId.trim();

    if (!normalizedRoomId) {
      throw new Error('معرف الغرفة غير صالح.');
    }

    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !sessionData.session?.user
    ) {
      const msg =
        'انتهت جلسة المستخدم. يرجى تسجيل الدخول مجددًا.';

      diagnosticsManager.update({
        edgeFunctionTokenStatus: 'Failed',
        lastCallError: msg,
      });

      throw new Error(msg);
    }

    try {
      const { data, error } =
        await supabase.functions.invoke(
          'generate-zego-token',
          {
            body: {
              roomId: normalizedRoomId,
            },
          },
        );

      if (error) {
        console.error(
          'ZEGO_EDGE_FUNCTION_ERROR:',
          error,
        );

        diagnosticsManager.update({
          edgeFunctionTokenStatus: 'Failed',
          lastCallError: error.message,
        });

        throw new Error(
          `فشل إصدار ZEGOCLOUD Token: ${error.message}`,
        );
      }

      const token =
        typeof data?.token === 'string'
          ? data.token.trim()
          : '';

      const responseAppId = Number(
        data?.appId || this.getAppId(),
      );

      const responseUserId = String(
        data?.userId || '',
      );

      if (!token || !token.startsWith('04')) {
        console.error(
          'ZEGO_INVALID_TOKEN_RESPONSE:',
          data,
        );

        diagnosticsManager.update({
          edgeFunctionTokenStatus: 'Failed',
          lastCallError:
            'لم ترجع الخدمة Token04 صالحًا.',
        });

        throw new Error(
          'لم يتم إصدار ZEGOCLOUD Token صالح.',
        );
      }

      if (
        responseUserId &&
        responseUserId !== userId
      ) {
        console.warn('ZEGO_USER_ID_MISMATCH:', {
          expected: userId,
          received: responseUserId,
        });
      }

      console.log('ZEGO_TOKEN_RECEIVED', {
        appId: responseAppId,
        userId,
        roomId: normalizedRoomId,
      });

      diagnosticsManager.update({
        edgeFunctionTokenStatus: 'Success',
        lastCallError: undefined,
      });

      const kitToken =
        ZegoUIKitPrebuilt.generateKitTokenForProduction(
          responseAppId,
          token,
          normalizedRoomId,
          userId,
          userName,
        );

      return kitToken;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'فشل الاتصال بخدمة إصدار Token.';

      diagnosticsManager.update({
        edgeFunctionTokenStatus: 'Failed',
        lastCallError: message,
      });

      throw error;
    }
  }

  /**
   * تهيئة ZEGOCLOUD وZIM مرة واحدة للمستخدم المسجل.
   */
  public async initForUser(
    user: User,
  ): Promise<void> {
    const userId = String(user?.id ?? '').trim();

    if (!userId) {
      const message =
        'لا يمكن تشغيل المكالمات بدون معرف مستخدم صحيح.';

      diagnosticsManager.update({
        zegoSdkStatus: 'Failed',
        lastCallError: message,
      });

      throw new Error(message);
    }

    if (
      this.isInitialized &&
      this.currentUserId === userId &&
      this.zpInstance
    ) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise =
      this.initializeInternal(user);

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async initializeInternal(
    user: User,
  ): Promise<void> {
    const userId = String(user.id).trim();

    const userName = String(
      user.name ||
        user.email ||
        'مستخدم',
    ).trim();

    this.destroy();

    this.currentUserId = userId;
    this.currentUserName = userName;

    // غرفة التهيئة الخاصة بإشارات هذا المستخدم.
    const signalingRoomId =
      `signaling_${userId}`;

    diagnosticsManager.update({
      zegoSdkStatus: 'Initializing',
      currentRoomId: signalingRoomId,
      joinedRoom: false,
      lastCallError: undefined,
    });

    console.log('ZEGO_INIT_START', {
      userId,
      userName,
      signalingRoomId,
    });

    try {
      const kitToken =
        await this.getProductionKitToken(
          signalingRoomId,
          userId,
          userName,
        );

      this.zpInstance =
        ZegoUIKitPrebuilt.create(kitToken);

      this.zpInstance.addPlugins({ ZIM });

      this.configureCallInvitation();

      this.isInitialized = true;

      diagnosticsManager.update({
        zegoSdkStatus: 'Ready',
        joinedRoom: false,
        currentRoomId: signalingRoomId,
        callStatus: 'Idle',
        lastCallError: undefined,
      });

      console.log('ZEGO_INSTANCE_READY', {
        currentUserId: this.currentUserId,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'فشل تهيئة خدمة المكالمات.';

      console.error(
        'ZEGO_INITIALIZATION_ERROR:',
        error,
      );

      this.zpInstance = null;
      this.isInitialized = false;

      diagnosticsManager.update({
        zegoSdkStatus: 'Failed',
        joinedRoom: false,
        lastCallError: message,
      });

      throw error;
    }
  }

  /**
   * إعداد دعوات الاتصال.
   */
  private configureCallInvitation(): void {
    if (!this.zpInstance) {
      throw new Error(
        'ZEGOCLOUD instance غير جاهزة.',
      );
    }

    this.zpInstance.setCallInvitationConfig({
      enableCustomCallInvitationDialog: false,
      endCallWhenInitiatorLeave: true,

      onSetRoomConfigBeforeJoining: (
        callType: number,
      ) => {
        const actualRoomId =
          this.zpInstance?.getRoomID?.() || undefined;

        if (actualRoomId) {
          console.log('ZEGO_ROOM_ID', {
            roomId: actualRoomId,
          });

          diagnosticsManager.update({
            currentRoomId: actualRoomId,
          });
        }

        return {
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining:
            callType ===
            ZegoUIKitPrebuilt.InvitationTypeVideoCall,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: true,
          showTextChat: false,
          showUserList: false,
          maxUsers: 2,
          onJoinRoom: () => {
            const roomId =
              this.zpInstance?.getRoomID?.() ||
              actualRoomId;

            diagnosticsManager.update({
              joinedRoom: true,
              currentRoomId: roomId,
              callStatus: 'Connected',
            });

            console.log('ZEGO_ROOM_JOINED', {
              userId: this.currentUserId,
              roomId,
            });
          },
          onLeaveRoom: () => {
            diagnosticsManager.update({
              joinedRoom: false,
              localStreamPublished: false,
              remoteStreamReceived: false,
              callStatus: 'Ended',
            });

            console.log('ZEGO_CALL_ENDED', {
              userId: this.currentUserId,
            });

            this.onCallEndedHandler?.();
          },
          onUserJoin: (users: any[]) => {
            diagnosticsManager.update({
              remoteStreamReceived: true,
            });

            console.log(
              'ZEGO_REMOTE_USER_JOINED',
              { users },
            );
          },
          onUserLeave: (users: any[]) => {
            console.log(
              'ZEGO_REMOTE_USER_LEFT',
              { users },
            );
          },
        };
      },

      onIncomingCallReceived: async (
        callID: string,
        caller: {
          userID: string;
          userName: string;
        },
        callType: number,
      ) => {
        console.log('ZEGO_INCOMING_CALL', {
          callID,
          callerUserId: caller.userID,
          calleeUserId: this.currentUserId,
          callType,
        });

        diagnosticsManager.update({
          callStatus: 'Ringing',
          currentRoomId: callID,
        });

        if (this.currentUserId) {
          try {
            await supabaseService.createCallRecord({
              id: callID,
              caller_id: caller.userID,
              receiver_id:
                this.currentUserId,
              type:
                callType ===
                ZegoUIKitPrebuilt
                  .InvitationTypeVideoCall
                  ? 'video'
                  : 'audio',
              status: 'ringing',
              roomId: callID,
            });
          } catch (error) {
            console.error(
              'CREATE_INCOMING_CALL_RECORD_ERROR:',
              error,
            );
          }
        }

        this.onIncomingCallHandler?.({
          callID,
          caller,
          callType,
        });
      },

      onIncomingCallCanceled: async (
        callID: string,
      ) => {
        console.log('ZEGO_INCOMING_CALL_CANCELED', {
          callID,
        });

        diagnosticsManager.update({
          callStatus: 'Idle',
        });

        try {
          await supabaseService.updateCallStatus(
            callID,
            'rejected',
          );
        } catch (error) {
          console.error(
            'UPDATE_CANCELED_CALL_ERROR:',
            error,
          );
        }

        this.onCallEndedHandler?.();
      },

      onOutgoingCallAccepted: async (
        callID: string,
        callee?: unknown,
      ) => {
        console.log('ZEGO_CALL_ACCEPTED', {
          callID,
          userId: this.currentUserId,
          callee,
        });

        diagnosticsManager.update({
          callStatus: 'Accepted',
          currentRoomId: callID,
        });

        try {
          await supabaseService.updateCallStatus(
            callID,
            'accepted',
          );
        } catch (error) {
          console.error(
            'UPDATE_ACCEPTED_CALL_ERROR:',
            error,
          );
        }

        this.onCallAcceptedHandler?.();
      },

      onOutgoingCallRejected: async (
        callID: string,
        callee?: unknown,
      ) => {
        console.log('ZEGO_OUTGOING_CALL_REJECTED', {
          callID,
          callee,
        });

        diagnosticsManager.update({
          callStatus: 'Rejected',
        });

        try {
          await supabaseService.updateCallStatus(
            callID,
            'rejected',
          );
        } catch (error) {
          console.error(
            'UPDATE_REJECTED_CALL_ERROR:',
            error,
          );
        }

        this.onCallEndedHandler?.();
      },

      onOutgoingCallTimeout: async (
        callID: string,
        callees?: unknown,
      ) => {
        console.log('ZEGO_OUTGOING_CALL_TIMEOUT', {
          callID,
          callees,
        });

        diagnosticsManager.update({
          callStatus: 'Missed',
        });

        try {
          await supabaseService.updateCallStatus(
            callID,
            'missed',
          );
        } catch (error) {
          console.error(
            'UPDATE_MISSED_CALL_ERROR:',
            error,
          );
        }

        this.onCallEndedHandler?.();
      },

      onCallInvitationEnded: (
        reason: unknown,
        data: unknown,
      ) => {
        console.log('ZEGO_CALL_INVITATION_ENDED', {
          reason,
          data,
        });

        diagnosticsManager.update({
          callStatus: 'Idle',
          joinedRoom: false,
        });

        this.onCallEndedHandler?.();
      },
    });
  }

  /**
   * إرسال دعوة اتصال صوتية أو فيديو.
   */
  public async sendCallInvitation(
    targetProfile: TargetProfile,
    type: CallType,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (
      !this.zpInstance ||
      !this.isInitialized
    ) {
      return {
        success: false,
        error:
          'خدمة المكالمات غير جاهزة. أعد تحميل الصفحة ثم جرّب مجددًا.',
      };
    }

    if (!this.currentUserId) {
      return {
        success: false,
        error:
          'لا يوجد مستخدم مسجل في خدمة المكالمات.',
      };
    }

    const targetUserId = String(
      targetProfile.id ?? '',
    ).trim();

    const targetUserName = String(
      targetProfile.name ||
        targetProfile.email ||
        'مستخدم',
    ).trim();

    if (!targetUserId) {
      return {
        success: false,
        error:
          'معرف المستخدم المطلوب غير صحيح.',
      };
    }

    if (
      targetUserId === this.currentUserId
    ) {
      return {
        success: false,
        error:
          'لا يمكنك الاتصال بحسابك نفسه.',
      };
    }

    const permissionResult =
      await this.requestMediaPermissions(type);

    if (!permissionResult.success) {
      return {
        success: false,
        error:
          permissionResult.errorMessage,
      };
    }

    const callType =
      type === 'video'
        ? ZegoUIKitPrebuilt
            .InvitationTypeVideoCall
        : ZegoUIKitPrebuilt
            .InvitationTypeVoiceCall;

    const callID = crypto.randomUUID();

    try {
      console.log('ZEGO_INVITATION_SENT', {
        callID,
        callerUserId: this.currentUserId,
        targetUserId,
        callType: type,
      });

      // Create call record in Supabase first
      await supabaseService.createCallRecord({
        id: callID,
        caller_id: this.currentUserId,
        receiver_id: targetUserId,
        type,
        status: 'ringing',
        roomId: callID,
      });

      const result =
        (await this.zpInstance.sendCallInvitation(
          {
            callees: [
              {
                userID: targetUserId,
                userName: targetUserName,
              },
            ],
            callType,
            timeout: 30,
            roomID: callID,
          },
        )) as InvitationResult;

      const failedInvitees =
        result?.errorInvitees ?? [];

      if (failedInvitees.length > 0) {
        const failedNames = failedInvitees
          .map(
            (invitee) =>
              invitee.userName ||
              invitee.userID,
          )
          .join(', ');

        const message =
          `تعذر إرسال الاتصال إلى: ${failedNames}`;

        diagnosticsManager.update({
          callStatus: 'Failed',
          lastCallError: message,
        });

        await supabaseService.updateCallStatus(
          callID,
          'failed',
        );

        return {
          success: false,
          error: message,
        };
      }

      diagnosticsManager.update({
        callStatus: 'Ringing',
        currentRoomId: callID,
        lastCallError: undefined,
      });

      return { success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'فشل إرسال دعوة الاتصال.';

      console.error(
        'ZEGO_SEND_CALL_INVITATION_ERROR:',
        error,
      );

      diagnosticsManager.update({
        callStatus: 'Failed',
        lastCallError: message,
      });

      return {
        success: false,
        error: message,
      };
    }
  }

  public registerListeners(
    callbacks: CallListeners,
  ): void {
    if (callbacks.onIncomingCall) {
      this.onIncomingCallHandler =
        callbacks.onIncomingCall;
    }

    if (callbacks.onCallEnded) {
      this.onCallEndedHandler =
        callbacks.onCallEnded;
    }

    if (callbacks.onCallAccepted) {
      this.onCallAcceptedHandler =
        callbacks.onCallAccepted;
    }
  }

  public isReady(): boolean {
    return Boolean(
      this.isInitialized &&
        this.zpInstance &&
        this.currentUserId,
    );
  }

  public getCurrentUserId():
    | string
    | null {
    return this.currentUserId;
  }

  public destroy(): void {
    if (this.zpInstance) {
      try {
        this.zpInstance.destroy();
      } catch (error) {
        console.warn(
          'ZEGO_DESTROY_WARNING:',
          error,
        );
      }
    }

    this.zpInstance = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.currentUserId = null;
    this.currentUserName = null;

    diagnosticsManager.update({
      zegoSdkStatus: 'Idle',
      joinedRoom: false,
      localStreamPublished: false,
      remoteStreamReceived: false,
      callStatus: 'Idle',
      currentRoomId: undefined,
    });
  }
}

export const zegoCallService =
  new ZegoCallService();
