import Router from 'koa-router';
import bcrypt from 'bcryptjs';
import type { App } from '@any-reader/shared';
import { getChapterCacheJob, startChapterCacheJob, stopChapterCacheJob } from './chapter-cache-jobs';

export function createRoute(api: App) {
  const router = new Router();

  router.post('/login', (ctx) => {
    const passwordConf = api.config.password;
    if (!passwordConf) {
      ctx.body = {
        code: 10001
      };
      return;
    }
    const { password } = ctx.request.body;
    if (bcrypt.compareSync(password, passwordConf)) {
      ctx.session!.uid = 1;
      ctx.body = {
        code: 0
      };
    } else {
      ctx.body = {
        code: -1,
        msg: '密码错误'
      };
    }
  });

  router.get('/logout', (ctx) => {
    ctx.session!.uid = null;
    ctx.body = {
      code: 0
    };
  });

  router.post('/chapter-cache/job/start', (ctx) => {
    try {
      ctx.body = {
        code: 0,
        data: startChapterCacheJob(api, ctx.request.body as Parameters<typeof startChapterCacheJob>[1]),
        msg: ''
      };
    } catch (error) {
      ctx.body = { code: -1, data: null, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  router.post('/chapter-cache/job/status', (ctx) => {
    const jobId = (ctx.request.body as { jobId?: string } | undefined)?.jobId;
    if (!jobId) {
      ctx.body = { code: -1, data: null, msg: '缓存任务 ID 不能为空' };
      return;
    }
    const data = getChapterCacheJob(jobId);
    ctx.body = data ? { code: 0, data, msg: '' } : { code: -1, data: null, msg: '缓存任务不存在' };
  });

  router.post('/chapter-cache/job/stop', (ctx) => {
    const jobId = (ctx.request.body as { jobId?: string } | undefined)?.jobId;
    if (!jobId) {
      ctx.body = { code: -1, data: null, msg: '缓存任务 ID 不能为空' };
      return;
    }
    const stopped = stopChapterCacheJob(jobId);
    ctx.body = stopped ? { code: 0, data: true, msg: '' } : { code: -1, data: null, msg: '缓存任务不存在' };
  });

  router.post('/install', (ctx) => {
    const passwordConf = api.config.password;
    if (passwordConf) {
      ctx.body = {
        code: 10002,
        msg: '已经设置过密码'
      };
      return;
    }
    const { password } = ctx.request.body;
    const storedPassword = /^[a-f\d]{32}$/i.test(password) ? bcrypt.hashSync(password, 10) : password;
    api.updateConfig({
      password: storedPassword
    });
    ctx.session!.uid = 1;
    ctx.body = {
      code: 0
    };
  });

  api.useApi(async (path: string, cb: any) => {
    if (typeof path !== 'string') return;
    const paths = path.split('@');
    if (paths.length !== 2) return;
    const method = paths[0].toLocaleLowerCase() as 'post' | 'get';
    router[method](`/${paths[1]}`, async (ctx) => {
      const data = method === 'get' ? ctx.query : ctx.request.body;
      ctx.body = await cb(data);
    });
  });

  return router;
}
