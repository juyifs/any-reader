<template>
  <div ref="contentRef" class="h-full w-full"></div>
</template>

<script setup>
import DPlayer from 'dplayer';
import { createVideoPlayback } from '@/utils/video';

const route = useRoute();

const contentRef = ref();
let player;
let playback;

onMounted(async () => {
  const url = String(route.query.url || '');
  playback = createVideoPlayback(url);
  player = new DPlayer({
    container: contentRef.value,
    autoplay: true,
    video: playback.video
  });
});

onBeforeUnmount(() => {
  player?.destroy();
  playback?.destroy();
});

watch(
  () => route.query,
  () => {
    location.reload();
  }
);
</script>
