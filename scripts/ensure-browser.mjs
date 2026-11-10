// 幂等启动「带 CDP 的专用浏览器窗口」。
// usage: node scripts/ensure-browser.mjs [--quiet] [--timeout 25]
// 退出码：0 已在跑/已启动，1 没找到浏览器，3 端口没起来
import { PORT, PROFILE, resolveBrowser, browserArgs, launchDetached, probe } from './config.mjs';
import { sleep } from './cdp.mjs';

const argv = process.argv.slice(2);
const getFlag = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i > -1 ? argv[i + 1] : def;
};
const quiet = argv.includes('--quiet');
const timeout = Number(getFlag('timeout', 25));

const already = await probe();
if (already) {
  if (!quiet) console.log(JSON.stringify({ status: 'already-running', browser: already, port: PORT }));
  process.exit(0);
}

const browser = resolveBrowser();
if (!browser) {
  console.error('ERROR: 没找到 Edge/Chrome。装一个，或用 XHS_BROWSER=/path/to/browser 指定。');
  process.exit(1);
}

launchDetached(browser, browserArgs());

for (let i = 0; i < timeout; i++) {
  await sleep(1000);
  const b = await probe();
  if (b) {
    if (!quiet) {
      console.log(JSON.stringify({ status: 'started', browser: b, port: PORT, profile: PROFILE, executable: browser }));
      console.log('首次使用：在弹出的窗口里用小红书 App 扫码登录；登录态会保存在上面的 profile 目录，之后不用再扫。');
    }
    process.exit(0);
  }
}
console.error(`ERROR: ${timeout} 秒内端口 ${PORT} 没起来。`);
console.error('- Linux 无头环境需要 Xvfb；容器里通常跑不了带登录态的浏览器。');
console.error('- 确认没有别的程序占用端口，或用 XHS_PORT=9333 换端口。');
console.error(`- 手动排查：${browser} --remote-debugging-port=${PORT} --user-data-dir="${PROFILE}"`);
process.exit(3);
