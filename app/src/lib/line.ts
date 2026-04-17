import crypto from 'crypto';

export type LineCommand =
  | { type: 'nextDelivery' }
  | { type: 'createProject'; projectName: string; deliveryDate: string; clientName?: string; place?: string }
  | { type: 'unknown' };

export function verifyLineSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;

  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

export function parseLineCommand(text: string): LineCommand {
  const trimmed = text.replace(/^OW!!\s*/iu, '').trim();

  if (/直近.*納品日|納品日.*直近|次の納品日|直近の納品/u.test(trimmed)) {
    return { type: 'nextDelivery' };
  }

  const dateMatch = trimmed.match(/納品日\s*(\d{4}-\d{2}-\d{2})/u);
  const projectMatch = trimmed.match(/プロジェクト名\s*[:：]?\s*([^\n\r]+)/u);
  const clientMatch = trimmed.match(/クライアント名\s*[:：]?\s*([^\n\r]+)/u);
  const placeMatch = trimmed.match(/場所\s*[:：]?\s*([^\n\r]+)/u);

  if (dateMatch && projectMatch) {
    return {
      type: 'createProject',
      projectName: projectMatch[1].trim(),
      deliveryDate: dateMatch[1],
      clientName: clientMatch?.[1]?.trim(),
      place: placeMatch?.[1]?.trim(),
    };
  }

  return { type: 'unknown' };
}

export function formatNextDeliveryReply(projects: Array<{ projectName: string; clientName: string; nextDeliveryDate: string | null }>): string {
  if (!projects.length) {
    return '現在、納品日の登録されているプロジェクトはありません。';
  }

  const lines = projects.map((project) => {
    const date = project.nextDeliveryDate ?? '未設定';
    const client = project.clientName ? `（${project.clientName}）` : '';
    return `- ${project.projectName}${client}: ${date}`;
  });

  return `直近納品日のプロジェクトです。\n${lines.join('\n')}`;
}

export function formatProjectCreateReply(projectName: string, deliveryDate: string, clientName?: string): string {
  const clientText = clientName ? `クライアント: ${clientName}。` : '';
  return `プロジェクト「${projectName}」を納品日 ${deliveryDate} で作成しました。${clientText}`;
}
