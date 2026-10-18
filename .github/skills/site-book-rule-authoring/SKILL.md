---
name: site-book-rule-authoring
description: "Use when a user provides a novel or book website URL and asks to create, complete, debug, or improve an any-reader source rule (书源规则、发现页、搜索、目录、正文). Inspect live pages and follow the repository's rule syntax rather than guessing selectors."
---

# Authoring any-reader Website Rules

Create a complete any-reader rule for a public novel/book website, grounded in the site's current pages and this repository's actual parser behavior.

## Workflow

1. **Identify the requested scope.** If the user asks for a full rule, cover search, discovery, book metadata, chapter list, and chapter content where the site supports them. If they provide an existing rule or report a failure, preserve working settings and focus on the failing flow.
2. **Read the rule contract and parser syntax.** Consult [rule documentation](../../../docs/rule/index.md), [expression reference](../../../docs/rule/expression.md), [rule type/defaults](../../../packages/rule-utils/src/rule.ts), [request handling](../../../packages/core/src/analyzer/request.ts), [rule parsing](../../../packages/core/src/analyzer/RuleManager.ts), and [HTML analyzer](../../../packages/core/src/analyzer/AnalyzerHtml.ts) as relevant. Check these before using unfamiliar fields or expression syntax.
3. **Inspect actual site pages.** Fetch the homepage or category page, a search results page, a representative book detail/catalog page, a chapter page, and any pagination page needed. Inspect raw HTML when readable output hides structure. Confirm selectors against the exact markup; do not infer one page's selectors from another.
4. **Map the navigation flow.**
   - Search/discovery item result should identify the book detail/catalog URL.
   - Chapter URL should resolve that book result to the chapter-list page.
   - Each chapter result should resolve to a chapter page.
   - Content selection should extract the actual chapter text, not navigation links or the whole page.
   - Only configure a next-page rule when it continues the current result list or chapter content. A “next chapter” link is not a content-pagination link.
5. **Build the rule using the site's markup.**
   - Enable discovery only when the user wants it or the requested full rule includes it. Use the documented `tab::url` / `group::tab::url` format and real category URLs.
   - Use the same list and metadata selectors for search and discovery only when their item markup matches.
   - Resolve relative covers explicitly where needed; use the site's stable origin and avoid a trailing slash in `host` when root-relative links are concatenated.
   - Keep the user's ID and metadata if completing a supplied JSON object; fill only relevant missing or incorrect fields.
6. **Validate the exact expressions and URLs.** Resolve a sample search/discovery item through the configured URL fields, fetch the resulting catalog and chapter URLs, and check that selectors return non-empty, expected values. Check the next-page selector on both a page with a next link and a last page. When possible, test expressions with the repository's parser or rule UI; a browser fetch alone does not prove the app's parser will interpret a rule correctly.
7. **Explain results and remaining uncertainty.** Return valid JSON when requested. Briefly state what was checked and disclose fields that could not be verified because of blocking, unavailable pages, or site changes. For a reported failure, identify the concrete failing URL/expression before suggesting a change.

## Parser-specific pitfalls

- Request URLs use `$result`, `$keyword`, `$page`, and related request variables in `parseRequest`. Do not put `{{result}}` into a request URL: request handling may treat a URL beginning with `{` as a JSON request object. `{{...}}` is for analyzer expression interpolation, not a replacement for request variables.
- `searchResult` and `discoverResult` are parsed differently: search resolves its result through `getUrl`, while discovery returns the configured string. Prefer a relative book link for both when the following chapter request can resolve it against `host`; confirm the exact output in the relevant flow.
- A root-relative link can become malformed if code concatenates it to a host ending in `/`. Use a normalized origin such as `http://example.com`, or verify URL joining behavior before constructing absolute URLs.
- In CSS rules, include an output operation such as `@text`, `@href`, `@src`, or `@html`. A selector without an operation may be treated as a whole-page HTML rule rather than a selected element.
- Distinguish catalog links from chapter links and chapter-next links from content-pagination links. Use observed markup and resolved URLs to verify each transition.
- Never guess pagination paths. Prefer the site's actual enabled “next” link and confirm the selector does not return disabled pagination controls on the last page.
- Check what each metadata element contains before adding text cleanup (`##` replacements). Do not remove useful content or assume author/category prefixes are identical across pages.
- Do not claim a rule works based only on syntactically valid JSON or successful page fetches; verify expected values at each supported stage.
