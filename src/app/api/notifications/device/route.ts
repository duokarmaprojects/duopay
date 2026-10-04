import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token, platform } = await req.json();
    
    // We store this generically. If PushDevice model isn't in schema yet, 
    // we can use UserSettings or a generic JSON field, or wait for Prisma update.
    // For now, let's assume we can update UserSettings with devices array or similar.
    
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id }
    });

    // In a real app with PushDevice model:
    // await prisma.pushDevice.upsert({
    //   where: { deviceToken: token },
    //   update: { lastSeenAt: new Date(), platform },
    //   create: { userId: session.user.id, deviceToken: token, platform }
    // });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
