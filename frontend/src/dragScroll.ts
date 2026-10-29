// Keep scrolling while the pointer is held at an edge, even without pointermove.
export function createDragScroll() {
  let frame: number | undefined;
  let point: { x: number; y: number; row: HTMLElement; update: () => void } | null = null;
  let previous = 0;
  function speed(position: number, start: number, end: number) {
    const edge = Math.min(48, (end - start) / 4);
    if (position < start || position > end) return 0;
    if (position < start + edge) return -600 * (1 - (position - start) / edge);
    if (position > end - edge) return 600 * (1 - (end - position) / edge);
    return 0;
  }
  function tick(time: number) {
    if (!point) return;
    const elapsed = previous ? Math.min(time - previous, 32) / 1000 : 0;
    previous = time;
    const rect = point.row.getBoundingClientRect();
    if (point.y >= rect.top && point.y <= rect.bottom) {
      point.row.scrollLeft += speed(point.x, Math.max(0, rect.left), Math.min(innerWidth, rect.right)) * elapsed;
    }
    if (point.x >= rect.left && point.x <= rect.right) {
      window.scrollBy(0, speed(point.y, 0, innerHeight) * elapsed);
    }
    point.update();
    frame = requestAnimationFrame(tick);
  }
  return {
    move(x: number, y: number, row: HTMLElement, update: () => void) {
      point = { x, y, row, update };
      if (frame === undefined) frame = requestAnimationFrame(tick);
    },
    stop() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined; point = null; previous = 0;
    },
  };
}
