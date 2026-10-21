<template>
  <div ref="contentRef" class="h-full w-full"></div>
</template>

<script setup>
import DPlayer from 'dplayer';
import { useBus, EVENT_TITLE_CHANGE } from '@/utils/bus';
import { createVideoPlayback } from '@/utils/video';

const route = useRoute();

const contentRef = ref();
const eventTitleChange = useBus(EVENT_TITLE_CHANGE);
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

  const { name, chapterName } = route.query;
  document.title = [name, chapterName].filter((e) => e).join('-');
  eventTitleChange.emit(document.title);
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
