<template>
  <a-button @click="open = true">缓存管理</a-button>
  <a-modal
    v-model:open="open"
    title="章节缓存"
    width="680px"
    :footer="null"
    :mask-closable="!running"
    :closable="!running"
    @after-open-change="onOpenChange"
  >
    <div class="mb-12">
      <a-radio-group v-model:value="destination" :disabled="running" @change="loadCacheList">
        <a-radio-button value="browser">当前浏览器</a-radio-button>
        <a-radio-button value="server">AnyReader 服务器</a-radio-button>
      </a-radio-group>
    </div>

    <div class="mb-12 flex flex-wrap items-center gap-8">
      <span>章节范围</span>
      <a-input-number v-model:value="rangeStart" :min="1" :max="chapters.length || 1" :disabled="running" />
      <span>至</span>
      <a-input-number v-model:value="rangeEnd" :min="1" :max="chapters.length || 1" :disabled="running" />
      <span>/ {{ chapters.length }}</span>
      <a-button type="primary" :disabled="running || !chapters.length" @click="cacheRange">缓存所选章节</a-button>
      <a-button :disabled="running || !chapters.length" @click="cacheAll">缓存全部</a-button>
    </div>

    <div v-if="running" class="mb-12">
      <div class="mb-6 flex items-center justify-between">
        <span>{{ progressText }}</span>
        <a-button size="small" @click="cancel">取消任务</a-button>
      </div>
      <a-progress :percent="progressPercent" :status="errorMessage ? 'exception' : 'active'" />
      <div v-if="currentChapterName" class="mt-4 text-12 op-70">{{ currentChapterName }}</div>
    </div>
    <a-alert v-if="errorMessage" class="mb-12" type="error" :message="errorMessage" show-icon />

    <div class="mb-8 flex items-center justify-between">
      <span>已缓存 {{ cachedChapters.length }} 章</span>
      <div class="flex gap-8">
        <a-button size="small" :disabled="!cachedChapters.length || running" @click="exportCache">导出</a-button>
        <a-popconfirm title="确定删除该书的全部缓存？" :disabled="!cachedChapters.length || running" @confirm="deleteAll">
          <a-button size="small" danger :disabled="!cachedChapters.length || running">删除全部</a-button>
        </a-popconfirm>
      </div>
    </div>
    <div class="max-h-280 overflow-auto border border-[--ar-chapter-bg] rounded-6 border-solid">
      <div
        v-for="item in cachedChapters"
        :key="item.chapterPath"
        class="flex items-center gap-8 border-b border-[--ar-chapter-bg] border-solid px-8 py-6"
      >
        <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" :title="item.chapterName">{{ item.chapterName }}</span>
        <a-button size="small" danger :disabled="running" @click="deleteOne(item.chapterPath)">删除</a-button>
      </div>
      <a-empty v-if="!cachedChapters.length" class="py-16" description="暂无缓存章节" />
    </div>
    <div class="mt-8 text-12 op-70">
      仅从源网站获取时限速：漫画图片间隔 5 秒；每章完成后，下一章前等待 30 秒。复制服务器缓存不等待；服务器缓存任务会在关闭浏览器后继续运行。
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { App } from 'ant-design-vue';
import { ContentType, type ContentResponse } from '@any-reader/rule-utils';
import { contentDecoder, getContent } from '@/api';
import {
  deleteServerChapterCache,
  exportServerChapterCache,
  getServerChapterCache,
  getServerChapterCacheJobStatus,
  listServerChapterCache,
  startServerChapterCacheJob,
  stopServerChapterCacheJob
} from '@/api/modules/chapter-cache';
import { useRulesStore } from '@/stores/rules';
import { getImageProxyUrl } from '@/utils/imageProxy';
import { saveAs } from 'file-saver';
import {
  deleteBrowserChapterCache,
  getBrowserChapterCache,
  listBrowserChapterCache,
  saveBrowserChapterCache,
  type ChapterCacheIdentity,
  type ChapterCacheRecord
} from '@/utils/chapterCache';

type ChapterItem = {
  chapterPath?: string;
  url?: string;
  name?: string;
};

const props = defineProps<{
  chapters: ChapterItem[];
  ruleId: string;
  bookUrl: string;
  bookName: string;
  contentType: number;
}>();
const emit = defineEmits<{
  cacheUpdated: [];
}>();

const { message } = App.useApp();
const rulesStore = useRulesStore();
const open = ref(false);
const destination = ref<'browser' | 'server'>('browser');
const rangeStart = ref(1);
const rangeEnd = ref(Math.max(1, props.chapters.length));
const running = ref(false);
const cachedChapters = ref<Array<{ chapterPath: string; chapterIndex: number; chapterName: string }>>([]);
const completed = ref(0);
const total = ref(0);
const currentChapterName = ref('');
const errorMessage = ref('');
const serverJobId = ref('');
let serverPollTimer: ReturnType<typeof setTimeout> | undefined;
let cancelled = false;
let cancelCurrentWait: (() => void) | undefined;
let currentAssetRequest: AbortController | undefined;

const identity = computed<ChapterCacheIdentity>(() => ({ ruleId: props.ruleId, url: props.bookUrl }));
const progressText = computed(() => `已缓存 ${completed.value}/${total.value} 章`);
const progressPercent = computed(() => (total.value ? Math.floor((completed.value / total.value) * 100) : 0));
const selectedRule = computed(() => rulesStore.list.find((rule) => rule.id === props.ruleId));

onBeforeUnmount(() => {
  if (serverPollTimer) clearTimeout(serverPollTimer);
});

watch(
  () => props.chapters.length,
  (length) => {
    rangeEnd.value = Math.max(1, length);
  }
);

function getChapterPath(chapter: ChapterItem) {
  return String(chapter.chapterPath || chapter.url || '');
}

function onOpenChange(visible: boolean) {
  if (visible) {
    void resumeServerJob();
    void loadCacheList();
  }
}

function persistedJobKey() {
  return `any-reader-chapter-cache-job:${encodeURIComponent(identity.value.ruleId)}:${encodeURIComponent(identity.value.url)}`;
}

async function resumeServerJob() {
  let savedJobId: string | null;
  try {
    savedJobId = localStorage.getItem(persistedJobKey());
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '无法恢复服务器缓存任务状态';
    return;
  }
  if (!savedJobId) return;
  destination.value = 'server';
  serverJobId.value = savedJobId;
  running.value = true;
  errorMessage.value = '';
  await pollServerJob(savedJobId);
}

function clearServerJob() {
  if (serverPollTimer) clearTimeout(serverPollTimer);
  serverPollTimer = undefined;
  try {
    localStorage.removeItem(persistedJobKey());
  } catch (error) {
    console.warn('清理服务器缓存任务状态失败', error);
  }
  serverJobId.value = '';
  running.value = false;
  currentChapterName.value = '';
}

async function pollServerJob(jobId: string) {
  try {
    const result = await getServerChapterCacheJobStatus(jobId);
    if (result.code !== 0 || !result.data) {
      errorMessage.value = result.msg || '无法获取服务器缓存任务状态';
      clearServerJob();
      return;
    }
    const status = result.data;
    const hasNewlyCompletedChapters = status.completed > completed.value;
    completed.value = status.completed;
    total.value = status.total;
    currentChapterName.value = status.currentChapterName;
    if (hasNewlyCompletedChapters) emit('cacheUpdated');
    if (status.state === 'running') {
      serverPollTimer = setTimeout(() => void pollServerJob(jobId), 1000);
      return;
    }
    clearServerJob();
    if (status.state === 'completed') message.success('章节缓存完成');
    else if (status.state === 'cancelled') message.info('缓存任务已停止，未完成章节已丢弃');
    else errorMessage.value = status.error || '服务器缓存任务失败';
    await loadCacheList();
    emit('cacheUpdated');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    serverPollTimer = setTimeout(() => void pollServerJob(jobId), 3000);
  }
}

async function loadCacheList() {
  try {
    if (destination.value === 'browser') {
      cachedChapters.value = (await listBrowserChapterCache(identity.value))
        .map(({ chapterPath, chapterIndex, chapterName }) => ({ chapterPath, chapterIndex, chapterName }))
        .sort((a, b) => a.chapterIndex - b.chapterIndex || a.chapterPath.localeCompare(b.chapterPath));
    } else {
      const result = await listServerChapterCache(identity.value);
      if (result.code !== 0) throw new Error(result.msg || '获取服务器缓存列表失败');
      cachedChapters.value = result.data.map(({ chapterPath, chapterIndex, chapterName }) => ({ chapterPath, chapterIndex, chapterName }));
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

function cacheAll() {
  void runCache(props.chapters);
}

function cacheRange() {
  const start = Math.max(1, Math.min(rangeStart.value || 1, props.chapters.length));
  const end = Math.max(start, Math.min(rangeEnd.value || start, props.chapters.length));
  void runCache(props.chapters.slice(start - 1, end));
}

async function runServerCache(chapters: ChapterItem[]) {
  running.value = true;
  cancelled = false;
  errorMessage.value = '';
  completed.value = 0;
  total.value = chapters.length;
  try {
    const result = await startServerChapterCacheJob({
      ...identity.value,
      contentType: props.contentType,
      chapters: chapters.map((chapter) => ({
        chapterPath: getChapterPath(chapter),
        chapterIndex: props.chapters.findIndex((item) => getChapterPath(item) === getChapterPath(chapter)),
        chapterName: chapter.name || getChapterPath(chapter)
      }))
    });
    if (result.code !== 0 || !result.data?.jobId) throw new Error(result.msg || '启动服务器缓存任务失败');
    serverJobId.value = result.data.jobId;
    try {
      localStorage.setItem(persistedJobKey(), serverJobId.value);
    } catch (error) {
      message.warning(error instanceof Error ? `服务器任务已启动，但无法保存恢复状态：${error.message}` : '服务器任务已启动，但无法保存恢复状态');
    }
    await pollServerJob(serverJobId.value);
  } catch (error) {
    clearServerJob();
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      if (cancelCurrentWait === finish) cancelCurrentWait = undefined;
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    cancelCurrentWait = finish;
  });
}

function resolveImageUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  const match = value.match(/@headers?(.+)$/);
  const imageUrl = match ? value.slice(0, match.index) : value;
  const host = selectedRule.value?.host;
  if (!host) return value;
  try {
    const resolved = new URL(imageUrl, host).toString();
    return match ? `${resolved}@${match[0].slice(1)}` : resolved;
  } catch {
    return value;
  }
}

async function decodeContent(content: ContentResponse): Promise<ContentResponse> {
  if (!content.contentDecoder) return content;
  const decoded = await Promise.all(
    content.content.map(async (item) => {
      const result = await contentDecoder({ content: item, ruleId: props.ruleId });
      if (result?.code !== 0) throw new Error(result?.msg || '章节解密失败');
      return result.data;
    })
  );
  return { ...content, content: decoded, contentDecoder: false };
}

async function loadSourceChapter(chapterPath: string): Promise<ContentResponse> {
  const result = await getContent({ filePath: props.bookUrl, chapterPath, ruleId: props.ruleId });
  if (result?.code !== 0) throw new Error(result?.msg || '获取章节内容失败');
  return decodeContent(result.data);
}

async function fetchChapterAssets(content: ContentResponse, chapter: ChapterItem) {
  const assets: Record<string, Blob | string> = {};
  if (props.contentType !== ContentType.MANGA) return assets;
  const urls = [...new Set(content.content.map((value) => resolveImageUrl(value)).filter((value) => /^https?:\/\//i.test(value)))];
  for (let index = 0; index < urls.length; index++) {
    if (cancelled) throw new Error('缓存任务已取消');
    const source = urls[index];
    const controller = new AbortController();
    currentAssetRequest = controller;
    try {
      const response = await fetch(getImageProxyUrl(source), { credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) throw new Error(`下载漫画图片失败 (${response.status}): ${chapter.name || ''}`);
      assets[source] = await response.blob();
    } finally {
      if (currentAssetRequest === controller) currentAssetRequest = undefined;
    }
    if (index < urls.length - 1) await wait(5000);
  }
  return assets;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('读取漫画图片失败'));
    reader.readAsDataURL(blob);
  });
}

async function cacheChapter(chapter: ChapterItem): Promise<boolean> {
  const chapterPath = getChapterPath(chapter);
  if (!chapterPath) throw new Error('章节路径为空');
  if (cancelled) throw new Error('缓存任务已取消');

  if (destination.value === 'browser' && (await getBrowserChapterCache(identity.value, chapterPath))) return false;
  const serverCache = await getServerChapterCache({ ...identity.value, chapterPath }).catch(() => undefined);
  if (destination.value === 'browser' && serverCache?.code === 0 && serverCache.data) {
    const assets: Record<string, Blob> = {};
    for (const [url, dataUrl] of Object.entries(serverCache.data.assets || {})) {
      if (cancelled) throw new Error('缓存任务已取消');
      const response = await fetch(dataUrl);
      assets[url] = await response.blob();
    }
    if (cancelled) throw new Error('缓存任务已取消');
    await saveBrowserChapterCache({ ...serverCache.data, assets });
    return false;
  }

  if (destination.value === 'server' && serverCache?.code === 0 && serverCache.data) return false;

  const content = await loadSourceChapter(chapterPath);
  if (cancelled) throw new Error('缓存任务已取消');
  const assets = await fetchChapterAssets(content, chapter);
  if (cancelled) throw new Error('缓存任务已取消');
  await saveBrowserChapterCache({
    ...identity.value,
    chapterPath,
    chapterIndex: props.chapters.findIndex((item) => getChapterPath(item) === chapterPath),
    chapterName: chapter.name || chapterPath,
    content,
    assets
  });
  return true;
}

async function runCache(chapters: ChapterItem[]) {
  if (running.value || !chapters.length) return;
  if (destination.value === 'server') {
    await runServerCache(chapters);
    return;
  }
  running.value = true;
  cancelled = false;
  errorMessage.value = '';
  completed.value = 0;
  total.value = chapters.length;
  try {
    for (let index = 0; index < chapters.length; index++) {
      if (cancelled) break;
      const chapter = chapters[index];
      currentChapterName.value = chapter.name || getChapterPath(chapter);
      const fetchedFromSource = await cacheChapter(chapter);
      completed.value++;
      await loadCacheList();
      emit('cacheUpdated');
      if (fetchedFromSource && index < chapters.length - 1 && !cancelled) await wait(30000);
    }
    if (cancelled) message.info('缓存任务已取消');
    else message.success('章节缓存完成');
  } catch (error) {
    if (cancelled) message.info('缓存任务已取消');
    else errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    running.value = false;
    currentChapterName.value = '';
    await loadCacheList();
    emit('cacheUpdated');
  }
}

async function cancel() {
  if (serverJobId.value) {
    try {
      const result = await stopServerChapterCacheJob(serverJobId.value);
      if (result.code !== 0) throw new Error(result.msg || '停止服务器缓存任务失败');
      if (serverPollTimer) clearTimeout(serverPollTimer);
      serverPollTimer = undefined;
      await pollServerJob(serverJobId.value);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
    return;
  }
  cancelled = true;
  currentAssetRequest?.abort();
  cancelCurrentWait?.();
}

async function deleteOne(chapterPath: string) {
  try {
    if (destination.value === 'browser') {
      await deleteBrowserChapterCache(identity.value, chapterPath);
    } else {
      const result = await deleteServerChapterCache({ ...identity.value, chapterPath });
      if (result.code !== 0) throw new Error(result.msg || '删除章节缓存失败');
    }
    await loadCacheList();
    emit('cacheUpdated');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

async function deleteAll() {
  try {
    if (destination.value === 'browser') {
      await deleteBrowserChapterCache(identity.value);
    } else {
      const result = await deleteServerChapterCache(identity.value);
      if (result.code !== 0) throw new Error(result.msg || '删除书籍缓存失败');
    }
    await loadCacheList();
    emit('cacheUpdated');
    message.success('缓存已删除');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

async function exportCache() {
  try {
    let records: ChapterCacheRecord[];
    if (destination.value === 'browser') {
      records = await listBrowserChapterCache(identity.value);
    } else {
      const result = await exportServerChapterCache(identity.value);
      if (result.code !== 0) throw new Error(result.msg || '导出服务器缓存失败');
      records = result.data;
    }
    const serialized = await Promise.all(
      records.map(async (record) => {
        const assets: Record<string, string> = {};
        for (const [url, asset] of Object.entries(record.assets || {})) {
          assets[url] = typeof asset === 'string' ? asset : await blobToDataUrl(asset);
        }
        return { ...record, assets };
      })
    );
    const blob = new Blob([JSON.stringify({ version: 1, book: { ...identity.value, name: props.bookName }, chapters: serialized }, null, 2)], {
      type: 'application/json'
    });
    saveAs(blob, `${props.bookName || 'chapter-cache'}.json`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}
</script>
