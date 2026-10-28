declare const worker: {
  fetch(
    request: Request,
    env?: {
      ALLOWED_ORIGINS?: string;
      AI?: { run(model: string, input: unknown): Promise<{ translated_text?: string }> };
    },
  ): Promise<Response>;
};
export default worker;
export function deeplHost(key: string): string;
export function pieces(text: string): string[];
