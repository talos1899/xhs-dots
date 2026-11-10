// 「像人一点」的小工具：贝塞尔鼠标轨迹、逐字输入、随机停顿、滚动。
// 说明：平台风控是服务端+行为层打分，这里只是降低「一眼机器」的特征，
// 不能保证不被拦；真正决定成败的是节奏、账号和 IP。
import { sleep } from './cdp.mjs';

export const rand = (a, b) => a + Math.random() * (b - a);

/** 人类停顿：默认 0.8–2.6 秒，长任务可以传更大区间 */
export async function pause(min = 800, max = 2600) {
  await sleep(rand(min, max));
}

/** 读完一段内容后的停顿：按字数估，0.8–4 秒 */
export async function readPause(text = '') {
  const n = String(text).length;
  await sleep(rand(700, 900) + Math.min(n * 6, 3000));
}

let cursor = { x: 320, y: 260 };

/** 分步移动鼠标（带轻微抖动和减速），返回落点 */
export async function moveMouse(p, x, y, steps = 14) {
  const from = { ...cursor };
  const cx = (from.x + x) / 2 + rand(-60, 60);
  const cy = (from.y + y) / 2 + rand(-60, 60);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t * t * (3 - 2 * t); // smoothstep：先快后慢
    const px = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * x;
    const py = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * y;
    await p.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(px + rand(-1.5, 1.5)),
      y: Math.round(py + rand(-1.5, 1.5)),
    });
    await sleep(rand(8, 22));
  }
  cursor = { x, y };
  return cursor;
}

/** 移动到元素中心再按下抬起（React 组件只认带 buttons 的真实点击序列） */
export async function humanClick(p, x, y) {
  await moveMouse(p, x, y);
  await sleep(rand(60, 160));
  await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(rand(40, 110));
  await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
}

/** 逐字输入：每个字符带间隔，偶尔卡顿，偶尔打错再退格 */
export async function typeHuman(p, text, { minDelay = 45, maxDelay = 150, typoRate = 0 } = {}) {
  for (const ch of text) {
    if (Math.random() < typoRate) {
      const wrong = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
      await p.send('Input.insertText', { text: wrong });
      await sleep(rand(90, 220));
      await p.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      await sleep(rand(80, 200));
    }
    // 键盘事件 + 逐字插入：CDP 里 CJK 只能靠 insertText 落地，
    // 所以补一对 keyDown/keyUp 让事件序列看起来完整（Playwright 也是这么做的）
    await p.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ch, code: '', windowsVirtualKeyCode: 0 });
    await p.send('Input.insertText', { text: ch });
    await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: '', windowsVirtualKeyCode: 0 });
    await sleep(rand(minDelay, maxDelay));
    if (Math.random() < 0.05) await sleep(rand(200, 700)); // 想一下再打
  }
}

/** 随机滚一点，模拟浏览 */
export async function scrollHuman(p, times = 2) {
  for (let i = 0; i < times; i++) {
    await p.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: Math.round(rand(300, 900)),
      y: Math.round(rand(300, 700)),
      deltaX: 0,
      deltaY: Math.round(rand(180, 520)),
    });
    await sleep(rand(300, 900));
  }
}
