import Hls from 'hls.js';

export function createVideoPlayback(url: string) {
  let hls: Hls | undefined;

  return {
    video: {
      url,
      type: 'customHls',
      customType: {
        customHls(video: HTMLVideoElement) {
          hls = new Hls();
          hls.loadSource(video.src);
          hls.attachMedia(video);
        }
      }
    },
    destroy() {
      hls?.destroy();
    }
  };
}
