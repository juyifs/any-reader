import Hls from 'hls.js';

export function createVideoPlayback(url: string) {
  let hls: Hls | undefined;
  const isHls = /\.m3u8(?:$|[?#])/i.test(url);

  return {
    video: isHls
      ? {
          url,
          type: 'customHls',
          customType: {
            customHls(video: HTMLVideoElement) {
              if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
              } else if (Hls.isSupported()) {
                hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
              } else {
                console.error('当前浏览器不支持 HLS 视频播放');
              }
            }
          }
        }
      : {
          url,
          type: 'auto'
        },
    destroy() {
      hls?.destroy();
    }
  };
}
