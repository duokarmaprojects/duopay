import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'mock-id',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || 'mock-key',
  secret: process.env.PUSHER_SECRET || 'mock-secret',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
  useTLS: true,
});

// Client instance
export const getPusherClient = () => {
  if (typeof window === 'undefined') return null;
  
  if (!window.pusherClient) {
    window.pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY || 'mock-key', {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
      authEndpoint: '/api/pusher/auth',
    });
  }
  
  return window.pusherClient;
};

declare global {
  interface Window {
    pusherClient?: PusherClient;
  }
}
