// @unocss-include

interface SpeakItem {
  node: HTMLElement;
  text: string;
  base64?: string;
}

export class TTS {
  private speakText: (text: string) => Promise<string>;
  private speakData: SpeakItem[];
  private idx = -1;
  private audioEl!: HTMLMediaElement;
  private _ended: () => void;
  private isFirstItem = true;
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
    this.audioEl = el;
    this.audioEl.addEventListener('ended', this._ended);
  }

  // 销毁
  destroy() {
    const row = this.speakData[this.idx - 1];
    row?.node.classList.remove('color-red');
    this.idx = -1;
    this.audioEl.pause();
    this.audioEl.removeEventListener('ended', this._ended);
    this.audioEl.parentElement?.removeChild(this.audioEl);
  }

  startOrStop() {
    if (this.audioEl.paused) {
      this.audioEl.play();
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

  async getTTS(idx: number) {
    if (idx > this.idx + 5) {
      setTimeout(() => {
        this.getTTS(idx);
      }, 1000);
      return;
    }

    if (idx < this.speakData.length) {
      const row = this.speakData[idx];
      row.base64 = await this.speakText(row.text);
      this.getTTS(idx + 1);
    }
  }

  start() {
    const row = this.speakData[this.idx];
    if (!row) {
      this._onEnd();
      return;
    }

    const { base64 } = row;
    if (typeof base64 === 'undefined') {
      setTimeout(() => {
        this.start();
      }, 1000);
      return;
    }
    this.idx++;
    row.node.classList.add('color-red');
    if (!row.base64) {
      this.ended();
      return;
    }
    this.audioEl.src = ('data:audio/mp3;base64,' + row.base64) as string;
    if (this.audioEl.paused) {
      this.audioEl.play();
    }
    this.followReadingPosition(row.node);
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
