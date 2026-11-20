// 영역 단위 실행 취소/다시 실행 (메모리 한도 내에서 보관)
export class History {
  constructor(maxBytes = 160 * 1024 * 1024, maxSteps = 60) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxBytes = maxBytes;
    this.maxSteps = maxSteps;
    this.bytes = 0;
    this.onChange = null;
  }

  static size(e) {
    return (e.before?.data.length || 0) + (e.after?.data.length || 0);
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
    apply(e, 'before');
    this.redoStack.push(e);
    this.onChange?.();
    return true;
  }

  redo(apply) {
    const e = this.redoStack.pop();
    if (!e) return false;
    apply(e, 'after');
    this.undoStack.push(e);
    this.onChange?.();
    return true;
  }

  // 레이어가 삭제되면 해당 레이어 기록 제거
  dropLayer(layerId) {
    const keep = (e) => e.layerId !== layerId;
    this.undoStack = this.undoStack.filter(keep);
    this.redoStack = this.redoStack.filter(keep);
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
