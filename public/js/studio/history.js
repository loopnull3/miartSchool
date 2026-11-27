// 영역 단위 실행 취소/다시 실행 (메모리 한도 내에서 보관)
// 기록 하나: { layerId, rect, before, after } 또는 여러 레이어를 한 번에 바꾼 { parts: [{ layerId, rect, before, after }] }
// before/after가 null이면 그 영역이 '완전히 빈 상태'라는 뜻 (메모리 절약)
export class History {
  constructor(maxBytes = 160 * 1024 * 1024, maxSteps = 60) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxBytes = maxBytes;
    this.maxSteps = maxSteps;
    this.bytes = 0;
    this.onChange = null;
  }

  static parts(e) {
    return e.parts || [e];
  }

  static size(e) {
    return History.parts(e).reduce((s, p) => s + (p.before?.data.length || 0) + (p.after?.data.length || 0), 0);
  }

  push(entry) {
    this.undoStack.push(entry);
    this.bytes += History.size(entry);
    for (const e of this.redoStack) this.bytes -= History.size(e);
    this.redoStack = [];
    while ((this.bytes > this.maxBytes || this.undoStack.length > this.maxSteps) && this.undoStack.length > 1) {
      this.bytes -= History.size(this.undoStack.shift());
    }
    this.onChange?.();
  }

  undo(apply) {
    const e = this.undoStack.pop();
    if (!e) return false;
    for (const p of [...History.parts(e)].reverse()) apply(p, 'before');
    this.redoStack.push(e);
    this.onChange?.();
    return true;
  }

  redo(apply) {
    const e = this.redoStack.pop();
    if (!e) return false;
    for (const p of History.parts(e)) apply(p, 'after');
    this.undoStack.push(e);
    this.onChange?.();
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
    this.onChange?.();
  }

  // 레이어가 삭제되면 해당 레이어 기록 제거
  dropLayer(layerId) {
    const strip = (stack) =>
      stack
        .map((e) => {
          if (!e.parts) return e.layerId === layerId ? null : e;
          const parts = e.parts.filter((p) => p.layerId !== layerId);
          return parts.length ? { ...e, parts } : null;
        })
        .filter(Boolean);
    this.undoStack = strip(this.undoStack);
    this.redoStack = strip(this.redoStack);
    this.bytes = [...this.undoStack, ...this.redoStack].reduce((s, e) => s + History.size(e), 0);
    this.onChange?.();
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
}
