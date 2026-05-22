export function requireElement<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`[UI] Missing required element: "${selector}"`);
  return el;
}

export function requireById<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`[UI] Missing required element: #${id}`);
  return el;
}
