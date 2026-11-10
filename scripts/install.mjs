// 把本仓库安装成一个技能目录，可选注册开机自启。
// usage:
//   node scripts/install.mjs                      # 自动选目录
//   node scripts/install.mjs --target ~/.dsh/skills
//   node scripts/install.mjs --autostart          # 登录系统时自动拉起浏览器
//   node scripts/install.mjs --autostart --remove # 取消自启
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = name => argv.indexOf('--' + name) > -1;
const value = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

const remove = flag('remove');

function skillsTarget() {
  const explicit = value('target', process.env.DSH_SKILLS_DIR);
  if (explicit) return path.resolve(explicit.replace(/^~(?=$|\/|\\)/, os.homedir()));
  const dsh = path.join(os.homedir(), '.dsh', 'skills');
  return fs.existsSync(path.join(os.homedir(), '.dsh')) ? dsh : path.resolve('skills');
}

function installSkill() {
  const target = path.join(skillsTarget(), 'xhs-dots');
  if (remove) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`已移除 ${target}`);
    return;
  }
  fs.mkdirSync(path.join(target, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'SKILL.md'), path.join(target, 'SKILL.md'));
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts'))) {
    if (f.endsWith('.mjs')) fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(target, 'scripts', f));
  }
  console.log(`技能已安装到 ${target}`);
  return target;
}

// ---------- 开机自启 ----------

const NODE = process.execPath;
const ENSURE = path.join(ROOT, 'scripts', 'ensure-browser.mjs');

function runPs(script) {
  const file = path.join(os.tmpdir(), `xhs-dots-${Date.now()}.ps1`);
  fs.writeFileSync(file, script, 'utf8');
  try {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], {
      stdio: 'inherit',
      windowsHide: true,
    });
    if (r.status !== 0) throw new Error(`PowerShell 退出码 ${r.status}`);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

function autostartWindows() {
  const startup = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const lnk = path.join(startup, 'XhsDotsEdge.lnk');
  if (remove) {
    fs.rmSync(lnk, { force: true });
    console.log(`已删除自启快捷方式 ${lnk}`);
    return;
  }
  runPs(`
$ErrorActionPreference = 'Stop'
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut('${lnk.replace(/'/g, "''")}')
$lnk.TargetPath = '${NODE.replace(/'/g, "''")}'
$lnk.Arguments = '"${ENSURE.replace(/'/g, "''")}" --quiet'
$lnk.WorkingDirectory = '${ROOT.replace(/'/g, "''")}'
$lnk.WindowStyle = 7
$lnk.Description = 'XHS Dots browser (CDP)'
$lnk.Save()
Write-Output ('CREATED ' + $lnk.FullName)
`);
  console.log('已注册开机自启；下次登录系统时会自动拉起浏览器窗口。');
}

function autostartMac() {
  const dir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const plist = path.join(dir, 'com.xhs-dots.browser.plist');
  if (remove) {
    spawnSync('launchctl', ['unload', plist], { stdio: 'ignore' });
    fs.rmSync(plist, { force: true });
    console.log(`已删除 ${plist}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.xhs-dots.browser</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE}</string>
    <string>${ENSURE}</string>
    <string>--quiet</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`);
  spawnSync('launchctl', ['load', plist], { stdio: 'ignore' });
  console.log(`已注册 ${plist}`);
}

function autostartLinux() {
  const dir = path.join(os.homedir(), '.config', 'autostart');
  const desktop = path.join(dir, 'xhs-dots.desktop');
  if (remove) {
    fs.rmSync(desktop, { force: true });
    console.log(`已删除 ${desktop}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(desktop, `[Desktop Entry]
Type=Application
Name=XHS Dots Browser
Exec="${NODE}" "${ENSURE}" --quiet
X-GNOME-Autostart-enabled=true
NoDisplay=true
`);
  console.log(`已注册 ${desktop}`);
}

if (flag('autostart')) {
  if (process.platform === 'win32') autostartWindows();
  else if (process.platform === 'darwin') autostartMac();
  else autostartLinux();
} else {
  installSkill();
  console.log('');
  console.log('下一步：');
  console.log(`  1. node "${ENSURE}"      # 启动浏览器并扫码登录`);
  console.log(`  2. node "${path.join(ROOT, 'scripts', 'dots.mjs')}" ask "上海适合自习的咖啡馆"`);
  console.log('  3. 想要开机自动拉起：node scripts/install.mjs --autostart');
}
