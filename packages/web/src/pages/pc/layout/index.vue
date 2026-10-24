<template>
  <BaseLayout>
    <div class="relative h-full w-full flex flex-col overflow-hidden text-[--ar-color-text]">
      <TopContainer>
        <div class="topbar__left w-20%" />
        <div class="w-60% flex flex-1 items-center justify-center gap-4">
          <span
            v-if="route.path !== '/books'"
            class="codicon app-region-none codicon-home w-22 cursor-pointer hover:op-70"
            @click="router.push('/books')"
          ></span>
          <span class="codicon app-region-none codicon-arrow-left w-22 cursor-pointer hover:op-70" @click="router.back"></span>
          <span class="codicon app-region-none codicon-arrow-right w-22 cursor-pointer hover:op-70" @click="router.forward"></span>
          <div
            class="app-region-none topbar__cmd ml-6 box-content h-22 max-w-600 w-38vw flex cursor-pointer items-center justify-center border-1 border-[--ar-cmd-border] rounded-6 border-solid bg-[--ar-cmd-bg] px-6 hover:bg-[--ar-cmd-active-bg]"
          >
            <div
              v-if="route.path === '/content'"
              class="h-full w-full flex items-center justify-center"
              :title="readStore.title"
              @click.stop="openChaptersBox.emit"
            >
              <span class="overflow-hidden text-ellipsis whitespace-nowrap" :title="readStore.title">{{ readStore.title }}</span>
            </div>
            <div v-else class="h-full w-full flex items-center justify-center" @click.stop="searchBox.emit">
              <span class="codicon codicon-search mr-10"></span>
              <span class="overflow-hidden text-ellipsis whitespace-nowrap">搜索</span>
            </div>
          </div>
        </div>
        <TitleBarRight :sidebar="true" />
      </TopContainer>
      <div class="relative flex flex-1 flex-col overflow-auto sm:flex-row">
        <!-- 侧边栏 - 小屏 -->
        <div
          v-if="route.path !== '/content' || readerTopBarVisible"
          :class="[
            'h-34 flex items-center bg-[--ar-main-background] px-10 lh-34 sm:hidden',
            route.path === '/content' ? 'absolute left-0 right-0 top-0 z-20 shadow-md' : ''
          ]"
          @click.stop
        >
          <div @click="navsShow = true"><MenuOutlined class="mr-5" /></div>
          <div class="app-region-drag flex flex-1 items-center justify-center">any-reader</div>
          <SearchOutlined @click="navTo('/search')" />
        </div>
        <!-- 侧边栏 - 大屏 -->
        <div
          v-if="settingStore.data.sidebar !== 'hidden'"
          class="hidden w-full flex-row border-r-1 border-r-[--ar-top-bar-border-bottom] border-r-solid bg-[--ar-left-bar-bg] py-10 text-24 text-[--ar-left-bar-text] sm:w-48 sm:flex sm:flex-col"
        >
          <!-- 收藏 -->
          <div
            v-for="nav in navs"
            :key="nav.path"
            :title="nav.title"
            :class="[
              'w-42 h-42 flex items-center justify-center hover:text-[--ar-color-primary] cursor-pointer',
              route.path === nav.path ? 'text-[--ar-color-primary]' : ''
            ]"
            @click="router.push(nav.path)"
          >
            <span :class="['codicon !text-24px', nav.icon]"></span>
          </div>
          <div class="flex-1"></div>

          <div :class="['w-42 h-42 flex items-center justify-center hover:text-[--ar-color-text] cursor-pointer']" @click="openSetting">
            <span :class="['codicon !text-24px codicon-settings-gear']"></span>
          </div>
        </div>
        <!-- 路由 -->
        <div ref="pageContentRef" class="flex-1 overflow-hidden bg-[--ar-main-background]" @click="handleReaderSurfaceClick">
          <RouterView v-slot="{ Component, route: _route }">
            <KeepAlive>
              <component :is="Component" v-if="_route.meta.keepAlive" :key="_route.path" />
            </KeepAlive>
            <component :is="Component" v-if="!_route.meta.keepAlive" :key="_route.path" />
          </RouterView>
        </div>
        <!-- 移动端菜单 -->
        <div
          v-if="navsShow"
          class="absolute bottom-0 left-0 right-0 top-0 z-10 bg-[#00000066] text-[--ar-left-bar-text]"
          @click="navsShow = false"
        ></div>
        <Transition
          :duration="3000"
          enter-from-class="op-0 translate-x--100"
          enter-to-class="op-100 translate-x-0"
          leave-from-class="op-100 translate-x-0"
          leave-to-class="op-0 translate-x--100"
        >
          <div
            v-if="navsShow"
            class="absolute bottom-0 left-0 right-0 top-0 z-11 h-full w-fit flex flex-col bg-[--ar-left-bar-bg] px-20 py-20 transition-all ease"
          >
            <div
              v-for="nav in navs"
              :key="nav.path"
              :title="nav.title"
              :class="[
                'h-34 lh-34 flex items-center justify-center hover:text-[--ar-color-primary] cursor-pointer',
                route.path === nav.path ? 'text-[--ar-color-primary]' : ''
              ]"
              @click="navTo(nav.path)"
            >
              <span :class="['codicon !text-24px mr-10', nav.icon]"></span>
              {{ nav.title }}
            </div>
            <div class="flex-1"></div>

            <div :class="['h-34 lh-34 flex items-center justify-center hover:text-[--ar-color-text] cursor-pointer']" @click="openSetting">
              <span :class="['codicon !text-24px codicon-settings-gear mr-10']"></span>
              设置
            </div>
          </div>
        </Transition>
      </div>
    </div>
    <Search />
  </BaseLayout>
</template>

<script setup lang="tsx">
import { App } from 'ant-design-vue';
import { useBus, EVENT_CHAPTERS_BOX, EVENT_SEARCH_BOX, EVENT_SETTING_BOX } from '@/utils/bus';
import { useSettingStore } from '@/stores/setting';
import { useReadStore } from '@/stores/read';
import Setting from '@/components/Setting/index.vue';
import Search from '@/components/Search/index.vue';
import BaseLayout from './components/BaseLayout.vue';
import TitleBarRight from './components/TitleBarRight.vue';
import TopContainer from './components/TopContainer.vue';
import { SettingOutlined } from '@ant-design/icons-vue';

const { modal } = App.useApp();
const route = useRoute();
const router = useRouter();
const settingStore = useSettingStore();
const readStore = useReadStore();
const openChaptersBox = useBus(EVENT_CHAPTERS_BOX);
const searchBox = useBus(EVENT_SEARCH_BOX);
const settingBox = useBus(EVENT_SETTING_BOX);

const navs = [
  { icon: 'codicon-home', path: '/books', title: '首页' },
  { icon: 'codicon-search', path: '/search', title: '搜索' },
  { icon: 'codicon-book', path: '/category/1', title: '小说' },
  { icon: 'codicon-library', path: '/category/0', title: '漫画' },
  { icon: 'codicon-play-circle', path: '/category/2', title: '视频' },
  { icon: 'codicon-music', path: '/category/3', title: '音频' },
  { icon: 'codicon-extensions', path: '/rules', title: '规则' }
];
const navsShow = ref(false);
const readerTopBarVisible = ref(false);
const pageContentRef = ref<HTMLElement>();
let readerTopBarTimer: ReturnType<typeof setTimeout> | undefined;

function hideReaderTopBar() {
  if (readerTopBarTimer) clearTimeout(readerTopBarTimer);
  readerTopBarVisible.value = false;
}

function handleReaderSurfaceClick(event: MouseEvent) {
  if (route.path !== '/content' || (event.target as HTMLElement).closest('a, button, input, textarea')) return;

  const bounds = pageContentRef.value?.getBoundingClientRect();
  if (!bounds) return;
  const inCenter =
    event.clientX >= bounds.left + bounds.width / 3 &&
    event.clientX <= bounds.right - bounds.width / 3 &&
    event.clientY >= bounds.top + bounds.height / 3 &&
    event.clientY <= bounds.bottom - bounds.height / 3;
  if (!inCenter) return;

  readerTopBarVisible.value = true;
  if (readerTopBarTimer) clearTimeout(readerTopBarTimer);
  readerTopBarTimer = setTimeout(() => {
    readerTopBarVisible.value = false;
  }, 3000);
}

watch(
  () => route.path,
  (path) => {
    if (path !== '/content') hideReaderTopBar();
  }
);

onUnmounted(() => {
  if (readerTopBarTimer) clearTimeout(readerTopBarTimer);
});

function openSetting() {
  modal.confirm({
    icon: <SettingOutlined class="!text-[--ar-color-text]" />,
    closable: true,
    mask: false,
    width: 600,
    footer: false,
    title: '设置',
    class: '!p-0',
    wrapClassName: '!p-0',
    content: <Setting class="pt-10" />
  });
}

settingBox.on(openSetting);

function navTo(path: string) {
  navsShow.value = false;
  router.push(path);
}
</script>
