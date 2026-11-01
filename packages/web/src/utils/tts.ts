// @unocss-include

interface SpeakItem {
  node: HTMLElement;
  text: string;
}

interface SpeakBatch {
  items: SpeakItem[];
  text: string;
  base64?: string;
  audio?: Promise<string>;
}

const MAX_BATCH_ITEMS = 3;
const MAX_BATCH_TEXT_LENGTH = 1000;

export class TTS {
  private speakText: (text: string) => Promise<string>;
  private speakData: SpeakBatch[];
  private idx = -1;
  private audioEl!: HTMLMediaElement;
  private _ended: () => void;
  private _onTimeUpdate: () => void;
  private _onVisibilityChange: () => void;
  private isFirstItem = true;
  private destroyed = false;
  private shouldPlay = true;
  private playbackBlocked = false;
  container: HTMLElement;
  private _onEnd: () => void;

  constructor(selector: string | HTMLElement, speakText: (text: string) => Promise<string>, onEnd: () => void) {
    this._ended = this.ended.bind(this);
    this._onTimeUpdate = this.handleTimeUpdate.bind(this);
    this._onVisibilityChange = this.handleVisibilityChange.bind(this);
    this._onEnd = onEnd;
    this.createAudio();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('pageshow', this._onVisibilityChange);
    window.addEventListener('focus', this._onVisibilityChange);
    this.speakText = speakText;
    const items: SpeakItem[] = [];
    this.speakData = [];
    this.container = typeof selector === 'string' ? (document.querySelector(selector) as HTMLElement) : selector;
    this.parseNodes(this.container, items);
    this.speakData = this.createSpeakBatches(items);
    this.idx = this.findCurrentPageStart();
    this.getTTS(this.idx);
    this.start();
  }

  createAudio() {
    const id = 'ttsAudio';
    let el = document.getElementById(id) as HTMLMediaElement;
    if (!el) {
      el = document.createElement('audio');
      el.id = id;
      document.body.append(el);
    }
    el.autoplay = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    this.audioEl = el;
    this.audioEl.addEventListener('ended', this._ended);
    this.audioEl.addEventListener('timeupdate', this._onTimeUpdate);
  }

  // 销毁
  destroy() {
    const batch = this.speakData[this.idx - 1];
    batch?.items.forEach(({ node }) => node.classList.remove('color-red'));
    this.destroyed = true;
    this.shouldPlay = false;
    this.idx = -1;
    if (!this.audioEl.ended) this.audioEl.pause();
    this.audioEl.removeEventListener('ended', this._ended);
    this.audioEl.removeEventListener('timeupdate', this._onTimeUpdate);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('pageshow', this._onVisibilityChange);
    window.removeEventListener('focus', this._onVisibilityChange);
  }

  startOrStop() {
    if (this.audioEl.paused) {
      this.playAudio();
    } else {
      this.shouldPlay = false;
      this.audioEl.pause();
      this.playbackBlocked = false;
    }
    return !this.audioEl.paused;
  }

  private playAudio() {
    this.shouldPlay = true;
    this.playbackBlocked = false;
    this.audioEl.play().then(
      () => {
        this.playbackBlocked = false;
      },
      (error) => {
        this.playbackBlocked = this.shouldPlay;
        console.error('朗读音频播放失败', error);
      }
    );
  }

  ended() {
    if (this.idx > 0) {
      const batch = this.speakData[this.idx - 1];
      batch?.items.forEach(({ node }) => node.classList.remove('color-red'));
    }
    this.start();
  }

  parseNodes(el: HTMLElement, items: SpeakItem[]) {
    if (['BUTTON'].includes(el.tagName)) {
      return;
    }
    if (el.childNodes.length) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
        this.parseNode(el, items);
      } else {
        for (const node of el.childNodes) {
          this.parseNodes(node as HTMLElement, items);
        }
      }
    } else {
      this.parseNode(el, items);
    }
  }

  parseNode(el: HTMLElement, items: SpeakItem[]) {
    const { innerText, nodeType, tagName } = el;
    if (innerText && !['SCRIPT', 'STYLE'].includes(tagName) && [Node.ELEMENT_NODE, Node.TEXT_NODE as number].includes(nodeType)) {
      items.push({
        node: el,
        text: innerText
      });
    }
  }

  private createSpeakBatches(items: SpeakItem[]) {
    const batches: SpeakBatch[] = [];
    let batchItems: SpeakItem[] = [];
    let batchTextLength = 0;

    const saveBatch = () => {
      if (!batchItems.length) return;
      batches.push({
        items: batchItems,
        text: batchItems.map(({ text }) => text).join('\n')
      });
      batchItems = [];
      batchTextLength = 0;
    };

    for (const item of items) {
      if (batchItems.length && (batchItems.length >= MAX_BATCH_ITEMS || batchTextLength + item.text.length > MAX_BATCH_TEXT_LENGTH)) {
        saveBatch();
      }
      batchItems.push(item);
      batchTextLength += item.text.length;
    }

    saveBatch();
    return batches;
  }

  private findCurrentPageStart() {
    const containerBounds = this.container.getBoundingClientRect();
    const isPaged = this.container.classList.contains('reader-paged-container');
    const currentIndex = this.speakData.findIndex(({ items }) =>
      items.some(({ node }) =>
        Array.from(node.getClientRects()).some((rect) =>
          isPaged
            ? rect.right > containerBounds.left &&
              rect.left < containerBounds.right &&
              rect.bottom > containerBounds.top &&
              rect.top < containerBounds.bottom
            : rect.bottom > containerBounds.top && rect.top < containerBounds.bottom
        )
      )
    );
    return currentIndex < 0 ? 0 : currentIndex;
  }

  getTTS(idx: number): Promise<string> | undefined {
    if (idx >= this.speakData.length || idx > this.idx + 5 || this.destroyed) return;

    const batch = this.speakData[idx];
    batch.audio ||= this.speakText(batch.text).then((base64) => {
      batch.base64 = base64;
      return base64;
    });
    void batch.audio
      .then(() => {
        this.getTTS(idx + 1);
      })
      .catch((error) => {
        console.error('朗读音频获取失败', error);
      });
    return batch.audio;
  }

  async start() {
    const batch = this.speakData[this.idx];
    if (!batch) {
      if (!this.destroyed) this._onEnd();
      return;
    }

    const idx = this.idx;
    this.idx++;
    batch.items.forEach(({ node }) => node.classList.add('color-red'));

    try {
      const audio = batch.audio || this.getTTS(idx);
      if (!audio) return;
      await audio;
    } catch (error) {
      return;
    }

    if (this.destroyed || this.idx !== idx + 1) return;

    if (!batch.base64) {
      this.ended();
      return;
    }
    this.audioEl.src = ('data:audio/mp3;base64,' + batch.base64) as string;
    this.playAudio();
    this.followReadingPosition(batch.items[0].node);
    this.getTTS(this.idx + 5);
  }

  private getCurrentBatchNode(batch: SpeakBatch) {
    if (!batch.items.length || !Number.isFinite(this.audioEl.duration) || this.audioEl.duration <= 0) {
      return batch.items[0]?.node;
    }

    const progress = Math.min(1, this.audioEl.currentTime / this.audioEl.duration);
    const totalLength = batch.items.reduce((total, item) => total + item.text.length, 0);
    let remainingLength = totalLength * progress;
    for (const item of batch.items) {
      remainingLength -= item.text.length;
      if (remainingLength <= 0) return item.node;
    }
    return batch.items[batch.items.length - 1].node;
  }

  private followReadingPosition(node: HTMLElement, force = false) {
    if (this.isFirstItem) {
      this.isFirstItem = false;
      return;
    }

    const containerBounds = this.container.getBoundingClientRect();
    const nodeBounds = node.getBoundingClientRect();

    if (this.container.classList.contains('reader-paged-container')) {
      if (force) {
        const nodeRects = Array.from(node.getClientRects());
        const isVisible = nodeRects.some((rect) => rect.right > containerBounds.left && rect.left < containerBounds.right);
        if (!isVisible && nodeRects.length) {
          const targetRect = nodeRects.reduce((closest, rect) => {
            const distance = Math.max(containerBounds.left - rect.right, rect.left - containerBounds.right, 0);
            const closestDistance = Math.max(containerBounds.left - closest.right, closest.left - containerBounds.right, 0);
            return distance < closestDistance ? rect : closest;
          });
          this.container.scrollBy({
            left: targetRect.left >= containerBounds.right ? targetRect.left - containerBounds.left : targetRect.right - containerBounds.right,
            behavior: 'smooth'
          });
        }
        return;
      }

      if (nodeBounds.left >= containerBounds.right) {
        this.container.scrollBy({
          left: this.container.clientWidth,
          behavior: 'smooth'
        });
      }
      return;
    }

    if (force) {
      const topMargin = 16;
      const bottomMargin = 16;
      const top = nodeBounds.top < containerBounds.top + topMargin ? nodeBounds.top - containerBounds.top - topMargin : 0;
      const bottom = nodeBounds.bottom > containerBounds.bottom - bottomMargin ? nodeBounds.bottom - containerBounds.bottom + bottomMargin : 0;
      const scrollTop = top || bottom;
      if (scrollTop) {
        this.container.scrollBy({
          top: scrollTop,
          behavior: 'smooth'
        });
      }
      return;
    }

    if (nodeBounds.bottom > containerBounds.bottom - 16) {
      this.container.scrollBy({
        top: Math.max(1, this.container.clientHeight - 30),
        behavior: 'smooth'
      });
    }
  }

  private handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;

    if (this.playbackBlocked && this.shouldPlay && this.audioEl.paused && !this.destroyed) {
      this.playAudio();
    }

    const batch = this.speakData[this.idx - 1];
    const node = batch && this.getCurrentBatchNode(batch);
    if (node) this.followReadingPosition(node, true);
  }

  private handleTimeUpdate() {
    const batch = this.speakData[this.idx - 1];
    const node = batch && this.getCurrentBatchNode(batch);
    if (node) this.followReadingPosition(node);
  }
}
