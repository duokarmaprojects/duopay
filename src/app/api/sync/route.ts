import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mutation = await req.json();
    const { id, type, payload } = mutation;

    // VERY basic idempotency using cache or checking if record with idempotency key exists
    // In production, we'd check an IdempotencyKey table

    if (type === 'CREATE_EXPENSE') {
      // Re-use the existing expense creation logic from server actions
      // For now, we manually create it to ensure server authority
      
      const { groupId, amount, description, date, payerId, categoryId, splits } = payload;
      
      // Verify user is in group
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { userId: session.user.id, groupId } }
      });

      if (!membership) {
         return NextResponse.json({ error: 'Not in group' }, { status: 403 });
      }

      // Check for exact idempotency
      const existing = await prisma.expense.findFirst({
        where: { id: id }
      });

      if (existing) {
        return NextResponse.json({ expense: existing, message: 'Already processed' });
      }

      // Create authoritative expense
      const expense = await prisma.expense.create({
        data: {
          id: id,
          groupId,
          amount,
          description,
          date: date ? new Date(date) : new Date(),
          payerId,
          category: categoryId,
          splitMethod: 'EXACT',
          participants: {
            create: splits.map((s: any) => ({
              userId: s.userId,
              share: s.amount
            }))
          }
        },
        include: { participants: true }
      });

      // TRIGGER REALTIME EVENT HERE
      await fetch(new URL('/api/pusher/trigger', req.url), {
        method: 'POST',
        body: JSON.stringify({
          channel: `group-${groupId}`,
          event: 'EXPENSE_CREATED',
          data: { expense }
        })
      }).catch(console.error);

      return NextResponse.json({ expense });
    }

    return NextResponse.json({ error: 'Unknown mutation type' }, { status: 400 });
  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
