import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSSEHeaders } from '@/lib/octra-agent/stream-handling';
import { getUserAISettings } from '@/lib/ai-provider';

// PRO limits configuration
const PRO_MONTHLY_EDIT_LIMIT = 500;
const FREE_DAILY_EDIT_LIMIT = 30;

function hasUnlimitedEdits(email?: string): boolean {
  if (!email) return false;
  const whitelistEnv = process.env.WHITELIST_EMAILS || '';
  const whitelistedEmails = whitelistEnv.split(',').map((e) => e.trim().toLowerCase());
  return whitelistedEmails.includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to use AI features.' },
        { status: 401 }
      );
    }

    const user = session.user;

    const hasUnlimited = hasUnlimitedEdits(user.email);

    if (!hasUnlimited) {
      const usageRes = await supabase
        .from('user_usage')
        .select('edit_count, monthly_edit_count, is_pro, daily_reset_date, monthly_reset_date')
        .eq('user_id', user.id)
        .single();
      
      let usageData = usageRes.data as any;
      const usageError = usageRes.error;

      if (usageError && usageError.code === 'PGRST116') {
        const newUsagePayload = {
          user_id: user.id,
          edit_count: 0,
          monthly_edit_count: 0,
          monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          is_pro: false,
          subscription_status: 'inactive',
        };

        const newUsageRes = await (supabase.from('user_usage') as any)
          .insert(newUsagePayload)
          .select('edit_count, monthly_edit_count, daily_reset_date, monthly_reset_date, is_pro')
          .single();
        
        if (newUsageRes.error) {
          return NextResponse.json(
            { error: 'Failed to initialize usage tracking' },
            { status: 500 }
          );
        }
        usageData = newUsageRes.data;
      } else if (usageError) {
        return NextResponse.json(
          { error: 'Failed to check usage limits' },
          { status: 500 }
        );
      }

      if (usageData) {
        const isPro = usageData.is_pro;
        const editCount = usageData.edit_count || 0;
        const monthlyEditCount = usageData.monthly_edit_count || 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dailyResetDate = usageData.daily_reset_date 
          ? new Date(usageData.daily_reset_date + 'T00:00:00')
          : null;
        const needsDailyReset = !isPro && dailyResetDate && today > dailyResetDate;

        const hasReachedLimit = isPro
          ? monthlyEditCount >= PRO_MONTHLY_EDIT_LIMIT
          : (!needsDailyReset && editCount >= FREE_DAILY_EDIT_LIMIT);

        if (hasReachedLimit) {
          const limitMessage = isPro
            ? `You've reached your monthly limit of ${PRO_MONTHLY_EDIT_LIMIT} edits. Your limit will reset on your billing date.`
            : `You've reached your daily limit of ${FREE_DAILY_EDIT_LIMIT} edits. Upgrade to Pro for ${PRO_MONTHLY_EDIT_LIMIT} edits per month!`;

          return NextResponse.json(
            { error: limitMessage, limitReached: true },
            { status: 429 }
          );
        }
      }
    }

    if (!hasUnlimited) {
      let incrementResult;
      try {
        const { data, error } = await supabase.rpc('increment_edit_count', { p_user_id: user.id } as any);
        if (error) {
          return NextResponse.json(
            { error: 'Failed to update usage tracking' },
            { status: 500 }
          );
        }
        incrementResult = data as boolean;
      } catch (incrementError) {
        return NextResponse.json(
          { error: 'Failed to update usage tracking' },
          { status: 500 }
        );
      }

      if (!incrementResult) {
        const usageRes = await supabase
          .from('user_usage')
          .select('is_pro, edit_count, monthly_edit_count')
          .eq('user_id', user.id)
          .single();
        
        const usageData = usageRes.data as any;
        const isPro = usageData?.is_pro || false;
        
        const limitMessage = isPro
          ? `You've reached your monthly limit of ${PRO_MONTHLY_EDIT_LIMIT} edits. Your limit will reset on your billing date.`
          : `You've reached your daily limit of ${FREE_DAILY_EDIT_LIMIT} edits. Upgrade to Pro for ${PRO_MONTHLY_EDIT_LIMIT} edits per month!`;

        return NextResponse.json(
          { error: limitMessage, limitReached: true },
          { status: 429 }
        );
      }
    }

    const remoteUrl = process.env.CLAUDE_AGENT_SERVICE_URL;
    if (!remoteUrl) {
      return NextResponse.json(
        {
          error: 'Agent service unavailable',
          details: 'CLAUDE_AGENT_SERVICE_URL is not configured on the server',
        },
        { status: 503 }
      );
    }

    const aiSettings = await getUserAISettings(supabase, user.id);
    const body = await request.json();
    body.aiConfig = aiSettings.agent; // Add aiConfig to the body to forward to agent server

    const res = await fetch(remoteUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      return NextResponse.json(
        { error: 'Remote agent service failed', status: res.status },
        { status: 502 }
      );
    }

    const { readable, writable } = new TransformStream();
    const reader = res.body.getReader();
    const writer = writable.getWriter();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
        try {
          await writer.close();
        } catch (e) {}
      } catch (err) {
        try {
          await writer.abort();
        } catch {}
      } finally {
        try {
          await reader.cancel();
        } catch {}
      }
    })();

    return new Response(readable, { headers: createSSEHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process agent request', details: message },
      { status: 500 }
    );
  }
}
