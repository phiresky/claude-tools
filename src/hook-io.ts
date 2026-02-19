export interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  session_id?: string;
  transcript_path?: string;
  [key: string]: unknown;
}

export async function readStdin(): Promise<HookInput> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as HookInput;
}

export function approve(): void {
  process.stdout.write(JSON.stringify({ decision: "approve" }) + "\n");
}

export function approveWithContext(ctx: string): void {
  process.stdout.write(
    JSON.stringify({ decision: "approve", additionalContext: ctx }) + "\n",
  );
}

export function block(reason: string): void {
  process.stdout.write(
    JSON.stringify({ decision: "block", reason }) + "\n",
  );
}

export function stopResult(opts: { systemMessage?: string } = {}): void {
  const result: Record<string, unknown> = {};
  if (opts.systemMessage) result.systemMessage = opts.systemMessage;
  process.stdout.write(JSON.stringify(result) + "\n");
}
