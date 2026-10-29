// @unocss-include

interface SpeakItem {
  node: HTMLElement;
  text: string;
  base64?: string;
  audio?: Promise<string>;
}

export class TTS {
  private speakText: (text: string) => Promise<string>;
  private speakData: SpeakItem[];
  private idx = -1;
  private audioEl!: HTMLMediaElement;
  private _ended: () => void;
  private isFirstItem = true;
  private destroyed = false;
  container: HTMLElement;
  private _onEnd: () => void;

  constructor(selector: string | HTMLElement, speakText: (text: string) => Promise<string>, onEnd: () => void) {
    this._ended = this.ended.bind(this);
    this._onEnd = onEnd;
    this.createAudio();
    this.speakText = speakText;
    this.speakData = [];
    this.container = typeof selector === 'string' ? (document.querySelector(selector) as HTMLElement) : selector;
    this.parseNodes(this.container);
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
  }

  // 销毁
  destroy() {
    const row = this.speakData[this.idx - 1];
    row?.node.classList.remove('color-red');
    this.destroyed = true;
    this.idx = -1;
    this.audioEl.pause();
    this.audioEl.removeEventListener('ended', this._ended);
  }

  startOrStop() {
    if (this.audioEl.paused) {
      this.audioEl.play().catch((error) => {
        console.error('朗读音频播放失败', error);
      });
    } else {
      this.audioEl.pause();
    }
    return !this.audioEl.paused;
  }

  ended() {
    if (this.idx > 0) {
      const row = this.speakData[this.idx - 1];
      if (row) {
        row.node.classList.remove('color-red');
      }
    }
    this.start();
  }

  parseNodes(el: HTMLElement) {
    if (['BUTTON'].includes(el.tagName)) {
      return;
    }
    if (el.childNodes.length) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
        this.parseNode(el);
      } else {
        for (const node of el.childNodes) {
          this.parseNodes(node as HTMLElement);
        }
      }
    } else {
      this.parseNode(el);
    }
  }

  parseNode(el: HTMLElement) {
    const { innerText, nodeType, tagName } = el;
    if (innerText && !['SCRIPT', 'STYLE'].includes(tagName) && [Node.ELEMENT_NODE, Node.TEXT_NODE as number].includes(nodeType)) {
      this.speakData.push({
        node: el,
        text: innerText
      });
    }
  }

  private findCurrentPageStart() {
    const containerBounds = this.container.getBoundingClientRect();
    const isPaged = this.container.classList.contains('reader-paged-container');
    const currentIndex = this.speakData.findIndex(({ node }) =>
      Array.from(node.getClientRects()).some((rect) =>
        isPaged
          ? rect.right > containerBounds.left &&
            rect.left < containerBounds.right &&
            rect.bottom > containerBounds.top &&
            rect.top < containerBounds.bottom
          : rect.bottom > containerBounds.top && rect.top < containerBounds.bottom
      )
    );
    return currentIndex < 0 ? 0 : currentIndex;
  }

  getTTS(idx: number): Promise<string> | undefined {
    if (idx >= this.speakData.length || idx > this.idx + 5 || this.destroyed) return;

    const row = this.speakData[idx];
    row.audio ||= this.speakText(row.text).then((base64) => {
      row.base64 = base64;
      return base64;
    });
    void row.audio
      .then(() => {
        this.getTTS(idx + 1);
      })
      .catch((error) => {
        console.error('朗读音频获取失败', error);
      });
    return row.audio;
  }

  async start() {
    const row = this.speakData[this.idx];
    if (!row) {
      if (!this.destroyed) this._onEnd();
      return;
    }

    const idx = this.idx;
    this.idx++;
    row.node.classList.add('color-red');

    try {
      const audio = row.audio || this.getTTS(idx);
      if (!audio) return;
      await audio;
    } catch (error) {
      return;
    }

    if (this.destroyed || this.idx !== idx + 1) return;

    if (!row.base64) {
      this.ended();
      return;
    }
    this.audioEl.src = ('data:audio/mp3;base64,' + row.base64) as string;
    this.audioEl.play().catch((error) => {
      console.error('朗读音频播放失败', error);
    });
    this.followReadingPosition(row.node);
    this.getTTS(this.idx + 5);
  }

  private followReadingPosition(node: HTMLElement) {
    if (this.isFirstItem) {
      this.isFirstItem = false;
      return;
    }

    const containerBounds = this.container.getBoundingClientRect();
    const nodeBounds = node.getBoundingClientRect();

    if (this.container.classList.contains('reader-paged-container')) {
      if (nodeBounds.left >= containerBounds.right) {
        this.container.scrollBy({
          left: this.container.clientWidth,
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
}
