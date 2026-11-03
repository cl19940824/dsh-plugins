#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dsh-plugins —— 一条命令让 dsh profile 和本仓库的插件保持一致。

用法：
  ./tools/sync-plugins.py                 # 拉代码 + 完全同步到当前 profile
  ./tools/sync-plugins.py -n              # 只看会做什么
  ./tools/sync-plugins.py -p web          # 同步到 web profile
  ./tools/sync-plugins.py --keep          # 只装不卸

选项：
  -p, --profile <名字>     目标 profile，默认取 $DSH_PROFILE，再退回 desktop
      --profile-dir <路径> 直接指定 profile 目录（优先级最高）
      --no-pull            跳过 git pull
      --keep               只装不删（仓库里已删掉的插件留在 profile 里）
      --enable-all         已装但不在 bundles 层的插件也一并启用
                           （默认只启用本次新装的，免得覆盖你在面板里手动关掉的）
  -n, --dry-run            只打印要做什么，不跑 pnpm、不写文件
      --pnpm PATH          指定 pnpm 可执行文件（默认自动找 PATH / dsh 自带）
  -h, --help               看帮助

退出码：0 = 已同步（或本来就一致）；1 = 出错（pnpm 失败 / manifest 异常）

它干五件事，幂等，反复跑没副作用：

  1. git pull --ff-only（拉最新代码；不是 git 仓库 / 没上游 / 有本地改动就只警告）
  2. 扫本仓库里所有声明了 dsh.bundle.patch 的目录（= 可装进 profile 的插件包）
  3. 缺的、指向别处的、软链断了的 → 一次 pnpm add link:<绝对路径> 装好
  4. 依赖还指着本仓库、但源目录已经不在仓库里的 → pnpm remove 卸掉
     （卸完顺手清掉 node_modules 里可能留下的悬空软链）
  5. 按「装完之后实际解析到的包」修 dsh.profile.bundles 层列表：
     新装的追加到末尾，已经不是 bundle 的依赖从列表里摘掉

「一致」= 仓库里有哪些插件，profile 里就有哪些；仓库里删掉的，profile 里也卸掉。
只动 link: 指向本仓库的那些依赖，别处的插件（第三方 npm 包、别的目录）一个都不碰。

为什么不用 `dsh plugin add`：desktop profile 被 Electron 应用独占，
`dsh plugin` 里那条守卫（全局 dsh 的 lib/bin.js:29）会直接拒绝 desktop。
本脚本做的事和它的 runPlugin 一致——在 profile 目录跑 pnpm，再 reconcile
dsh.profile.bundles；只是不碰 cordis.patch.yml，也不改任何插件源码。

生效范围：host 半边（宿主 Node 进程）有 ESM 缓存，装完/卸完要在菜单里
「重启服务」；浏览器半边刷新页面即可。
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

# 扫描时跳过的目录名（不会放插件包，或者放进去也不该被自动装）
SKIP_DIRS = {
    "node_modules", ".git", ".github", ".vscode",
    "dist", "build", "docs", "coverage",
}
# 扫描深度：仓库根往下一层（插件包平铺），加一层余量兜 packages/xxx 这种布局
MAX_DEPTH = 2

# ---------------------------------------------------------------- 终端着色
_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _paint(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text


def bold(text: str) -> str:
    return _paint("1", text)


def dim(text: str) -> str:
    return _paint("2", text)


def green(text: str) -> str:
    return _paint("32", text)


def yellow(text: str) -> str:
    return _paint("33", text)


def red(text: str) -> str:
    return _paint("31", text)


def cyan(text: str) -> str:
    return _paint("36", text)


HELP = __doc__.rstrip() + "\n"


class Failure(Exception):
    """能直接打给用户看的错误。"""


# ---------------------------------------------------------------- 参数
def parse_args(argv):
    options = {
        "profile": None,
        "profile_dir": None,
        "pull": True,
        "keep": False,
        "enable_all": False,
        "dry_run": False,
        "pnpm": None,
        "help": False,
    }
    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg in ("-p", "--profile"):
            index += 1
            if index >= len(argv):
                raise Failure(f"{arg} 需要跟一个 profile 名字")
            options["profile"] = argv[index]
        elif arg == "--profile-dir":
            index += 1
            if index >= len(argv):
                raise Failure("--profile-dir 需要跟一个路径")
            options["profile_dir"] = argv[index]
        elif arg == "--no-pull":
            options["pull"] = False
        elif arg in ("--keep", "--no-prune"):
            options["keep"] = True
        elif arg == "--prune":  # 老写法：删除现在是默认行为，接受但没用
            options["keep"] = False
        elif arg == "--enable-all":
            options["enable_all"] = True
        elif arg == "--pnpm":
            index += 1
            if index >= len(argv):
                raise Failure("--pnpm 需要跟一个路径")
            options["pnpm"] = argv[index]
        elif arg in ("-n", "--dry-run"):
            options["dry_run"] = True
        elif arg in ("-h", "--help"):
            options["help"] = True
        else:
            raise Failure(f"不认识的选项：{arg}（用 --help 看用法）")
        index += 1
    return options


def dsh_home() -> Path:
    """dsh 的 home 目录：$DSH_HOME 优先，否则 ~/.dsh。"""
    raw = os.environ.get("DSH_HOME", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return Path.home() / ".dsh"


def resolve_profile_dir(options) -> Path:
    if options["profile_dir"]:
        return Path(options["profile_dir"]).expanduser().resolve()
    name = options["profile"] or os.environ.get("DSH_PROFILE") or "desktop"
    return dsh_home() / "profiles" / name


# ---------------------------------------------------------------- 读包
def read_manifest(directory: Path):
    """读一个 package.json；坏 JSON 抛带路径的错误。"""
    path = directory / "package.json"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as error:
        raise Failure(f"读不了 {path}：{error.strerror or error}")
    try:
        return path, json.loads(text)
    except json.JSONDecodeError as error:
        raise Failure(f"{path} 不是合法 JSON：{error}")


def bundle_patch_of(manifest):
    """目录是不是可装进 profile 的插件包：声明了 dsh.bundle.patch。"""
    dsh = manifest.get("dsh") or {}
    bundle = dsh.get("bundle") or {}
    patch = bundle.get("patch")
    return patch if isinstance(patch, str) and patch else None


def collect_plugins(root: Path):
    """扫仓库里的插件包，返回 [{name, version, dir, patch}]，按名字排序。"""
    found = []
    seen = {}

    def walk(directory: Path, depth: int):
        try:
            entries = list(directory.iterdir())
        except OSError:
            return
        if (directory / "package.json").is_file():
            try:
                _, manifest = read_manifest(directory)
            except Failure:
                manifest = None  # 坏 manifest 当作普通目录，继续往下看
            if manifest is not None:
                patch = bundle_patch_of(manifest)
                name = manifest.get("name")
                if (
                    isinstance(name, str) and name
                    and patch is not None and (directory / patch).exists()
                ):
                    found.append({
                        "name": name,
                        "version": str(manifest.get("version") or "0.0.0"),
                        "dir": str(directory),
                        "patch": patch,
                    })
                # 带 package.json 的目录不再往下钻：一个包就是一个插件
                return
        if depth >= MAX_DEPTH:
            return
        for entry in entries:
            if not entry.is_dir() or entry.name.startswith(".") or entry.name in SKIP_DIRS:
                continue
            walk(entry, depth + 1)

    walk(root.resolve(), 0)
    for plugin in found:
        previous = seen.get(plugin["name"])
        if previous is not None:
            raise Failure(
                f"仓库里有两个同名插件 {plugin['name']}：\n  {previous}\n  {plugin['dir']}"
            )
        seen[plugin["name"]] = plugin["dir"]
    return sorted(found, key=lambda item: item["name"])


def resolves_to_bundle(profile_dir: Path, name: str) -> bool:
    """用安装后的真实状态判断某个依赖是不是 profile 层（解析到包 + 声明了 dsh.bundle.patch）。"""
    package_dir = profile_dir.joinpath("node_modules", *name.split("/"))
    if not package_dir.exists():
        return False
    try:
        _, manifest = read_manifest(package_dir)
    except Failure:
        return False
    return bundle_patch_of(manifest) is not None


def remove_dangling_link(profile_dir: Path, name: str) -> bool:
    """清掉 node_modules 里指向已消失目录的软链。

    悬空软链只有 lstat 看得见——Path.exists() 对它返回 False，所以先判 is_symlink。
    """
    link = profile_dir.joinpath("node_modules", *name.split("/"))
    try:
        if link.is_symlink() and not link.exists():
            link.unlink()
            return True
    except OSError:
        pass
    return False


def under(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


# ---------------------------------------------------------------- 外部命令
def _pnpm_executable() -> str:
    """pnpm 的可执行名；Windows 上是 pnpm.cmd。"""
    return "pnpm.cmd" if os.name == "nt" else "pnpm"


def _pnpm_on_system():
    """PATH 或常见的 pnpm 安装位置。找到返回 [路径]，否则 None。"""
    exe = _pnpm_executable()
    found = shutil.which(exe)
    if found:
        return [found]
    homes = [
        os.environ.get("PNPM_HOME"),
        str(Path.home() / "Library" / "pnpm"),          # macOS pnpm 默认
        str(Path.home() / ".local" / "share" / "pnpm"),  # Linux
        str(Path.home() / "AppData" / "Local" / "pnpm"), # Windows
    ]
    for home in homes:
        if not home:
            continue
        candidate = Path(home) / exe
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return [str(candidate)]
    return None


def _pnpm_bundled():
    """dsh 桌面版自带的 pnpm（用同一个运行时里的 node 跑 pnpm.cjs）。

    没装过 pnpm、PATH 里也没有的时候，这是最省事的一份——版本还和面板里用的一致。
    """
    roots = []
    env = os.environ.get("DSH_APP")
    if env:
        roots.append(Path(env).expanduser())
    roots.append(Path("/Applications/DeepSeek Harness.app"))
    roots.append(Path.home() / "Applications" / "DeepSeek Harness.app")
    for root in roots:
        runtime = root / "Contents" / "Resources" / "runtime"
        if not runtime.is_dir():
            continue
        for script in sorted(runtime.glob("*/dependencies/pnpm/bin/pnpm.cjs")):
            node = script.parents[2] / "node" / "bin" / "node"
            if node.is_file():
                return [str(node), str(script)]
    return None


def find_pnpm(explicit=None):
    """返回调用 pnpm 的命令前缀（list）；找不到返回 None。"""
    if explicit:
        path = Path(explicit).expanduser()
        if not path.is_file():
            raise Failure(f"--pnpm 指向的文件不存在：{path}")
        return [str(path)]
    return _pnpm_on_system() or _pnpm_bundled()


def run(args, cwd: Path):
    """跑子进程并透传输出，返回退出码。"""
    try:
        return subprocess.run(args, cwd=str(cwd)).returncode
    except FileNotFoundError:
        raise Failure(f"PATH 里没有 {args[0]}")


def git_pull(repo_root: Path):
    """git pull --ff-only；失败只警告（离线 / 有本地改动 / 没上游都不该挡住同步）。"""
    if not (repo_root / ".git").exists():
        print(dim("· 不是 git 仓库，跳过 git pull"))
        return
    print(bold("→ git pull --ff-only"))
    try:
        code = subprocess.run(
            ["git", "-C", str(repo_root), "pull", "--ff-only"], check=False
        ).returncode
    except FileNotFoundError:
        print(yellow("! 没有 git 命令，跳过 git pull"))
        return
    if code != 0:
        print(yellow("! git pull 没成功（本地改动 / 没上游 / 离线？），继续用现有代码同步"))


# ---------------------------------------------------------------- 报告
def report_dormant(manifest, profile_dir: Path, to_install, options):
    """提示「装好了但没启用」的插件；dry-run 和实跑共用同一套判定。"""
    bundles = ((manifest.get("dsh") or {}).get("profile") or {}).get("bundles") or []
    just_installed = {plugin["name"] for plugin in to_install}
    dormant = []
    for name in (manifest.get("dependencies") or {}):
        if name in bundles:
            continue
        if options["enable_all"] or name in just_installed:
            continue
        if resolves_to_bundle(profile_dir, name):
            dormant.append(name)
    if dormant:
        print(yellow(f"! {len(dormant)} 个已安装的插件不在 bundles 层（= 没启用）：{', '.join(dormant)}"))
        print(dim("  大概是你在面板里关掉的，脚本不会替你重新打开；要一并启用加 --enable-all"))


def main(argv) -> int:
    options = parse_args(argv)
    if options["help"]:
        sys.stdout.write(HELP)
        return 0

    repo_root = REPO_ROOT
    profile_dir = resolve_profile_dir(options)
    manifest_path = profile_dir / "package.json"
    print(bold(f"仓库  {repo_root}"))
    print(bold(f"profile {profile_dir}"))
    if options["dry_run"]:
        print(yellow("（dry-run：只打印，不改任何东西）"))

    if not manifest_path.is_file():
        print(red(f"✗ 没有找到 {manifest_path}"), file=sys.stderr)
        print("  这个 profile 还没初始化？先在 dsh 里启动一次，或用 --profile / --profile-dir 指对地方。", file=sys.stderr)
        return 1

    pnpm = find_pnpm(options["pnpm"])
    if not pnpm:
        print(red("✗ 找不到 pnpm"), file=sys.stderr)
        print("  找过：PATH、PNPM_HOME、~/Library/pnpm，以及 dsh 桌面版自带的运行时。", file=sys.stderr)
        print("  装一个（npm i -g pnpm），或用 --pnpm /path/to/pnpm 指过去。", file=sys.stderr)
        return 1
    options["pnpm_cmd"] = pnpm
    if len(pnpm) > 1:
        print(dim(f"· 用 dsh 自带的 pnpm：{pnpm[-1]}"))

    if options["pull"] and not options["dry_run"]:
        git_pull(repo_root)

    plugins = collect_plugins(repo_root)
    if not plugins:
        print(red(f"✗ {repo_root} 里没扫到任何插件包（要有 package.json 且声明 dsh.bundle.patch）"), file=sys.stderr)
        return 1
    print(f"扫描到 {len(plugins)} 个插件包\n")

    _, before = read_manifest(profile_dir)
    dependencies = before.get("dependencies") or {}
    to_install = []
    stale = []
    lines = []

    # 1) 仓库里有的：该装 / 该改指向 / 该重建软链 / 已就绪
    for plugin in plugins:
        want = f"link:{plugin['dir']}"
        have = dependencies.get(plugin["name"])
        linked = profile_dir.joinpath("node_modules", *plugin["name"].split("/")).exists()
        label = f"{plugin['name']:<24} {plugin['version']:<8}"
        if have is None:
            to_install.append({**plugin, "reason": "未安装"})
            lines.append(f"  {green('+')} {label} 未安装")
        elif have != want:
            to_install.append({**plugin, "reason": f"源不同（现为 {have}）"})
            lines.append(f"  {cyan('↻')} {label} 改指向（现为 {have}）")
        elif not linked:
            to_install.append({**plugin, "reason": "软链断了"})
            lines.append(f"  {cyan('↻')} {label} 软链断了，重装")
        else:
            lines.append(f"  {dim('·')} {label} 已就绪")

    # 2) 仓库里已经没有、但依赖还 link: 指着本仓库的：该卸
    #    判据是「指向本仓库 + 目录不在了」，所以第三方插件、别处目录的 link 都不会被误删。
    for name, spec in dependencies.items():
        if not isinstance(spec, str) or not spec.startswith("link:"):
            continue
        target = Path(os.path.expanduser(spec[len("link:"):]))
        if not target.is_absolute():
            target = (profile_dir / target).resolve()
        if not under(target, repo_root) or target.exists():
            continue
        stale.append(name)
        action = "（加 --keep 可保留）" if options["keep"] else "，将卸载"
        lines.append(f"  {yellow('-')} {name:<24} {'':<8} 源目录已不在仓库{action}")

    print("\n".join(lines))
    print()

    if options["dry_run"]:
        if not to_install and (not stale or options["keep"]):
            print(green("✓ 已经是同步状态，没有要做的"))
        else:
            count = 0 if options["keep"] else len(stale)
            print(dim(f"dry-run：会装/重指 {len(to_install)} 个，卸载 {count} 个"))
        report_dormant(before, profile_dir, to_install, options)
        return 0

    # 3) 装 / 重指：一次 pnpm add 搞定，dependencies、lockfile、软链都由 pnpm 写
    if to_install:
        specs = [f"link:{plugin['dir']}" for plugin in to_install]
        print(bold(f"→ pnpm add {len(specs)} 个 link 依赖"))
        code = run([*options["pnpm_cmd"], "add", *specs], profile_dir)
        if code != 0:
            print(red(f"✗ pnpm add 失败（退出码 {code}），bundles 层没有动"), file=sys.stderr)
            return 1

    # 4) 卸载仓库里已经删掉的插件
    pruned = [] if options["keep"] else stale
    if pruned:
        print(bold(f"→ pnpm remove {len(pruned)} 个已失效插件"))
        code = run([*options["pnpm_cmd"], "remove", *pruned], profile_dir)
        if code != 0:
            print(red(f"✗ pnpm remove 失败（退出码 {code}）"), file=sys.stderr)
            return 1
        # pnpm 对指向已消失目录的 link: 依赖只清 manifest/lockfile，会留悬空软链
        for name in pruned:
            remove_dangling_link(profile_dir, name)

    # 5) reconcile bundles：新装的追加；已经不是 bundle 的依赖摘掉；内置层永远不动
    _, after = read_manifest(profile_dir)
    after_deps = list((after.get("dependencies") or {}))
    bundles = list(((after.get("dsh") or {}).get("profile") or {}).get("bundles") or [])
    added, dormant = [], []
    just_installed = {plugin["name"] for plugin in to_install}
    for name in after_deps:
        if not resolves_to_bundle(profile_dir, name) or name in bundles:
            continue
        if options["enable_all"] or name in just_installed:
            bundles.append(name)
            added.append(name)
        else:
            dormant.append(name)

    removed = []
    dependency_names = set(dependencies) | set(after_deps)
    for name in list(bundles):
        if name not in dependency_names:
            continue  # 内置层（@deepseek-ai/dsh-base 等）不是依赖，永远不动
        if not (name in after_deps and resolves_to_bundle(profile_dir, name)):
            bundles.remove(name)
            removed.append(name)

    changed = bool(added or removed)
    if changed:
        dsh = dict(after.get("dsh") or {})
        profile = dict(dsh.get("profile") or {})
        profile["bundles"] = bundles
        dsh["profile"] = profile
        after["dsh"] = dsh
        manifest_path.write_text(
            json.dumps(after, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        for name in added:
            print(f"  {green('+')} 加入 bundles 层：{name}")
        for name in removed:
            print(f"  {yellow('-')} 移出 bundles 层：{name}")

    # 6) 收尾报告
    in_sync = not to_install and not pruned and not changed and (not stale or options["keep"])
    print()
    if in_sync:
        print(green("✓ 全部已同步，没有要做的"))
    else:
        parts = [f"装/重指 {len(to_install)} 个"]
        if pruned:
            parts.append(f"卸载 {len(pruned)} 个")
        parts.append(f"bundles 层 +{len(added)} / -{len(removed)}")
        print(green("✓ 同步完成：" + "，".join(parts)))
    report_dormant(after, profile_dir, to_install, options)
    if to_install or pruned or changed:
        print(dim("  新装 / 卸掉的插件要「菜单 → 重启服务」才进 host 半边；浏览器半边刷新页面即可"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Failure as error:
        print(red(f"✗ {error}"), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
