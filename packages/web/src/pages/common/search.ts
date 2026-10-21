import { v4 as uuidV4 } from 'uuid';
import pLimit from 'p-limit';
import { ContentType } from '@any-reader/rule-utils';
import { searchByRuleId } from '@/api';
import { useRulesStore } from '@/stores/rules';

const PAGE_PATTERN = /(\$page)|((^|[^a-zA-Z'"_/-])page([^a-zA-Z0-9'"]|$))/;

export function useSearch() {
  const rulesStore = useRulesStore();

  const route = useRoute();
  const router = useRouter();

  let uuid: string = '';
  const searchText = ref('');
  const contentType = ref(ContentType.NOVEL);
  const selectedRuleId = ref('');
  const contentTypes = computed(() => [contentType.value]);
  const availableRules = computed(() => rulesStore.list.filter((rule) => contentTypes.value.includes(rule.contentType) && rule.enableSearch));
  const loading = ref(false);
  const total = ref(0);
  const runCount = ref(0);

  const list = ref<any[]>([]);

  async function onSearch(uid?: string) {
    const runPromise = pLimit(10);
    const lastUuid = uid || uuidV4();
    uuid = lastUuid;
    list.value = [];
    total.value = 0;
    runCount.value = 0;
    loading.value = true;
    const rules = availableRules.value.filter((rule) => !selectedRuleId.value || rule.id === selectedRuleId.value);
    total.value = rules.length;

    const tasks = rules.map((rule) =>
      runPromise(() => {
        return new Promise((c) => {
          if (lastUuid !== uuid) return c(true);
          runCount.value++;
          searchByRuleId({ ruleId: rule.id, keyword: searchText.value, page: 1 })
            .then((res) => {
              if (res.code === 0 && lastUuid === uuid) {
                const rows = res.data;
                if (!rows.length) return;
                list.value.push({
                  rule: rule,
                  list: rows,
                  page: 1,
                  hasMore: PAGE_PATTERN.test(rule.searchUrl)
                });
              }
            })
            .finally(() => c(true));
        });
      })
    );
    await Promise.all(tasks).catch(() => {});
    if (lastUuid === uuid) loading.value = false;
  }

  async function loadMore() {
    const groups = list.value.filter((item) => item.hasMore);
    if (loading.value || groups.length === 0) return;

    const runPromise = pLimit(10);
    const lastUuid = uuidV4();
    uuid = lastUuid;
    loading.value = true;
    total.value = groups.length;
    runCount.value = 0;

    const tasks = groups.map((group) =>
      runPromise(
        () =>
          new Promise((resolve) => {
            if (lastUuid !== uuid) return resolve(true);
            runCount.value++;
            const page = group.page + 1;
            searchByRuleId({ ruleId: group.rule.id, keyword: searchText.value, page })
              .then((res) => {
                if (lastUuid !== uuid || res.code !== 0) return;
                const rows = res.data;
                if (rows.length) {
                  group.list.push(...rows);
                  group.page = page;
                } else {
                  group.hasMore = false;
                }
              })
              .catch((error) => console.error('搜索下一页失败', error))
              .finally(() => resolve(true));
          })
      )
    );

    await Promise.all(tasks).catch(() => {});
    if (lastUuid === uuid) loading.value = false;
  }

  function cancelSearch() {
    uuid = uuidV4();
    loading.value = false;
  }

  watch(contentType, () => {
    selectedRuleId.value = '';
    cancelSearch();
    list.value = [];
  });

  function init() {
    const { keyword, _uuid } = route.query;
    if (searchText.value === keyword && uuid === _uuid) return;
    if (keyword) {
      searchText.value = keyword as string;
      onSearch(_uuid as string);
    }
  }

  onMounted(init);
  onActivated(init);
  onDeactivated(cancelSearch);

  function getChapter(row: any, rule: any) {
    router.push({
      path: '/chapter',
      query: {
        ...row,
        filePath: row.url,
        ruleId: rule.id
      }
    });
  }

  return {
    getChapter,
    contentType,
    selectedRuleId,
    availableRules,
    cancelSearch,
    searchText,
    onSearch,
    loadMore,
    loading,
    runCount,
    total,
    list
  };
}
