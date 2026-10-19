declare const worker: {
  fetch(request: Request, env?: { ALLOWED_ORIGINS?: string }): Promise<Response>;
};
export default worker;
export function deeplHost(key: string): string;
