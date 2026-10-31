import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';
import Koa from 'koa';
import { bodyParser } from '@koa/bodyparser';
import cors from '@koa/cors';
import serve from 'koa-static';
import session from 'koa-session';
import { createApp } from '@any-reader/shared';
import { createRoute } from './routes';
import { fetchPublicImage, InvalidImageRefererError } from './image-fetcher';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

const ROOT_PATH = path.join(os.homedir(), '.any-reader');
const CONFIG_PATH = path.join(ROOT_PATH, 'config.desktop.json');

const app = new Koa();

async function proxyImage(ctx: Koa.ParameterizedContext) {
  const { url: imageUrl, headers: rawHeaders = '{}' } = ctx.query;
  if (typeof imageUrl !== 'string' || typeof rawHeaders !== 'string') {
    ctx.status = 400;
    ctx.body = 'Missing image URL or headers';
    return;
  }

  let suppliedHeaders: Record<string, unknown>;
  try {
    suppliedHeaders = JSON.parse(rawHeaders);
  } catch {
    ctx.status = 400;
    ctx.body = 'Invalid image headers';
    return;
  }

  try {
    const image = await fetchPublicImage(imageUrl, suppliedHeaders);
    ctx.type = image.contentType;
    ctx.set('Cache-Control', 'private, max-age=3600');
    ctx.body = image.data;
  } catch (error) {
    ctx.status = error instanceof InvalidImageRefererError ? 400 : 502;
    ctx.body = error instanceof InvalidImageRefererError ? 'Invalid Referer' : error instanceof Error ? error.message : '图片代理请求失败';
  }
}

export async function start(port = 8898, root = resolve(__dirname, 'public')) {
  const api = createApp({
    configPath: CONFIG_PATH
  });
  const router = createRoute(api);
  router.get('/image-proxy', proxyImage);
  router.get('/api/image-proxy', proxyImage);
  app.keys = ['any-reader'];
  const SESSION_CONFIG = {
    key: 'any-reader',
    maxAge: 24 * 60 * 60 * 1000 * 7,
    httpOnly: true
    // rolling: true
  };

  app
    .use(session(SESSION_CONFIG, app))
    .use(async (ctx, next) => {
      if (
        ctx.session!.uid ||
        ['/favicon.ico', '/login', '/install', '/', '/kindle.html', 'index.html'].includes(ctx.path) ||
        /^\/assets\//.test(ctx.path)
      ) {
        await next();
        return;
      }
      // 没有登录
      const password = api.config.password;
      // 没有设置密码
      if (!password) {
        ctx.body = {
          code: 10001
        };
        return;
      }
      // 设置了密码
      ctx.body = {
        code: 401
      };
    })
    .use(bodyParser({ encoding: 'utf-8', jsonLimit: '60mb' }))
    .use(cors())
    .use(router.routes())
    .use(router.allowedMethods())
    .use(serve(root))
    .listen(port);
}
