import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/realtime/pusher';

export async function POST(req: Request) {
  try {
    const { channel, event, data } = await req.json();
    
    // In production, ensure this route is securely called internally 
    // or validate a secret token if exposed.
    
    // Try to trigger Pusher. If mock keys are used, it might fail, 
    // but we can catch it to allow the app to run without keys.
    await pusherServer.trigger(channel, event, data).catch((err) => {
      console.warn('Pusher trigger warning (likely missing keys):', err.message);
    });
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
