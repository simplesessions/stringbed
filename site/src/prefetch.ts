// Model bytes are requested the moment the catalog names them, in parallel with the 3D code and
// the renderer's setup (the slow part). three.js parses the buffer once it is ready, so the
// downloads are no longer queued behind the renderer.
const buffers = new Map<string, Promise<ArrayBuffer>>();

export function fetchModelBytes(url: string, priority: 'high' | 'low' | 'auto' = 'auto'): Promise<ArrayBuffer> {
  let pending = buffers.get(url);
  if (!pending) {
    pending = fetch(url, { priority } as RequestInit).then((res) => {
      if (!res.ok) throw new Error(`The server answered ${res.status}.`);
      return res.arrayBuffer();
    });
    pending.catch(() => buffers.delete(url)); // forgotten, so a retry fetches again
    buffers.set(url, pending);
  }
  return pending;
}
