import interact from 'interactjs';
import type { PixelBounds } from './types.ts';

export interface WindowInteractionOptions {
  element: HTMLElement;
  canvas: HTMLElement;
  titlebar: HTMLElement;
  minimum: { width: number; height: number };
  onFocus(): void;
  onCommit(bounds: PixelBounds): void;
}

function readBounds(element: HTMLElement, canvas: HTMLElement): PixelBounds {
  const elementRect = element.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  return {
    x: elementRect.left - canvasRect.left,
    y: elementRect.top - canvasRect.top,
    width: elementRect.width,
    height: elementRect.height
  };
}

function clampBounds(bounds: PixelBounds, canvas: HTMLElement, minimum: { width: number; height: number }): PixelBounds {
  const canvasRect = canvas.getBoundingClientRect();
  const width = Math.min(canvasRect.width, Math.max(minimum.width, bounds.width));
  const height = Math.min(canvasRect.height, Math.max(minimum.height, bounds.height));
  return {
    x: Math.max(0, Math.min(canvasRect.width - width, bounds.x)),
    y: Math.max(0, Math.min(canvasRect.height - height, bounds.y)),
    width,
    height
  };
}

function apply(element: HTMLElement, bounds: PixelBounds): void {
  element.style.left = `${bounds.x}px`;
  element.style.top = `${bounds.y}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;
}

export function bindWindowInteractions(options: WindowInteractionOptions): () => void {
  const { element, canvas, titlebar, minimum } = options;
  const minWidth = Math.min(minimum.width, canvas.clientWidth);
  const minHeight = Math.min(minimum.height, canvas.clientHeight);
  let bounds = readBounds(element, canvas);

  const interactable = interact(element)
    .draggable({
      allowFrom: titlebar,
      ignoreFrom: 'button, input, select, textarea, a, [data-no-drag]',
      listeners: {
        start: () => {
          bounds = readBounds(element, canvas);
          options.onFocus();
        },
        move: (event) => {
          bounds = clampBounds({ ...bounds, x: bounds.x + event.dx, y: bounds.y + event.dy }, canvas, { width: minWidth, height: minHeight });
          apply(element, bounds);
        },
        end: () => options.onCommit(bounds)
      }
    })
    .resizable({
      edges: { top: '.desktop-resize-n', right: '.desktop-resize-e', bottom: '.desktop-resize-s', left: '.desktop-resize-w' },
      listeners: {
        start: () => {
          bounds = readBounds(element, canvas);
          options.onFocus();
        },
        move: (event) => {
          bounds = clampBounds({
            x: bounds.x + event.deltaRect.left,
            y: bounds.y + event.deltaRect.top,
            width: event.rect.width,
            height: event.rect.height
          }, canvas, { width: minWidth, height: minHeight });
          apply(element, bounds);
        },
        end: () => options.onCommit(bounds)
      }
    });

  return () => interactable.unset();
}
