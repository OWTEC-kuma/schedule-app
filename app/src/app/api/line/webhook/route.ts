import { NextResponse } from 'next/server';
import { parseLineCommand, verifyLineSignature, formatNextDeliveryReply, formatProjectCreateReply } from '@/lib/line';
import { generateChatReply } from '@/lib/openai';

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

async function replyToLine(replyToken: string, text: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  }

  await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN ?? process.env.LINE_API_TOKEN ?? '';

function getInternalApiUrl(path: string, request: Request) {
  if (INTERNAL_API_BASE_URL) {
    return new URL(path, INTERNAL_API_BASE_URL).toString();
  }
  return new URL(path, request.url).toString();
}

async function fetchInternalApi(request: Request, path: string, options: RequestInit = {}) {
  const url = getInternalApiUrl(path, request);
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(options.headers ?? {} as Record<string, string>)),
  };

  if (INTERNAL_API_TOKEN) {
    headers.Authorization = `Bearer ${INTERNAL_API_TOKEN}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response.json();
}

async function fetchNextDelivery(request: Request) {
  return fetchInternalApi(request, '/api/projects/next-delivery', { method: 'GET' });
}

async function createProject(request: Request, projectName: string, deliveryDate: string, clientName?: string, place?: string) {
  const body = {
    id: `line-${Date.now()}`,
    projectName,
    clientName: clientName ?? '',
    deliveries: [{ date: deliveryDate, place: place ?? '' }],
    children: [],
  };

  return fetchInternalApi(request, '/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-line-signature') ?? '';
  const bodyText = await request.text();

  if (!verifyLineSignature(bodyText, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(bodyText);
  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') {
      continue;
    }

    const text = event.message.text;
    const command = parseLineCommand(text);
    let replyText = 'すみません、今のところその命令には対応していません。';

    if (command.type === 'nextDelivery') {
      const data = await fetchNextDelivery(request);
      if (data.error) {
        replyText = '直近納品日を取得できませんでした。';
      } else {
        replyText = formatNextDeliveryReply(data.projects || []);
      }
    } else if (command.type === 'createProject') {
      const data = await createProject(
        request,
        command.projectName,
        command.deliveryDate,
        command.clientName,
        command.place
      );
      if (data.error) {
        replyText = `プロジェクトの作成に失敗しました: ${data.error}`;
      } else {
        replyText = formatProjectCreateReply(command.projectName, command.deliveryDate, command.clientName);
      }
    } else {
      try {
        const prompt = `次のLINEメッセージを受け取りました。社内プロジェクト管理システムで返答するときの自然な文章を作成してください。\n\nメッセージ: ${text}`;
        replyText = await generateChatReply(prompt);
      } catch (error) {
        console.error(error);
        replyText = '申し訳ありません。現在はその内容に対応できません。';
      }
    }

    if (event.replyToken) {
      await replyToLine(event.replyToken, replyText);
    }
  }

  return NextResponse.json({ ok: true });
}
