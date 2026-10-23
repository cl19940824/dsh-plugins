#!/usr/bin/env bash
#
# dsh-plugins —— 新开发机一键初始化（GitHub SSH 免密推送）
#
#   bash tools/setup-github-ssh.sh [目标目录]
#
# 干四件事（可反复执行，全部幂等）：
#   1. 生成**这台机器自己的** GitHub 专用 ed25519 密钥（已存在就复用，绝不覆盖）
#   2. 在 ~/.ssh/config 里维护一段带标记的配置：github.com 走 GitHub 官方
#      ssh.github.com:443（公司网络常把 22 端口掐掉），另留 github-22 备用别名；
#      **标记段以外的内容一个字都不动**
#   3. 引导你把公钥贴到 GitHub，并当场用 ssh -T 验证
#   4. 把仓库 clone 到目标目录（默认 ~/Code/github/dsh-plugins），并把 origin
#      指到 SSH，之后 git push 不再需要任何凭据
#
# 只写 ~/.ssh 和你指定的目录；不 sudo、不碰 SourceTree 配置、不碰其它 host、
# 不改全局 git 身份（那两行命令最后会打给你，自己决定跑不跑）。
#
# 选项：
#   -d, --dir <路径>   clone 到哪（默认 ~/Code/github/dsh-plugins）
#   -n, --no-clone     只配 SSH，不 clone
#   -y, --yes          非交互：不等待贴公钥，直接给出结果
#   -h, --help         看帮助
#
set -u

REPO_SSH="git@github.com:cl19940824/dsh-plugins.git"
REPO_HTTPS="https://github.com/cl19940824/dsh-plugins.git"
KEYS_URL="https://github.com/settings/keys"
KEY="$HOME/.ssh/id_ed25519_github"
CFG="$HOME/.ssh/config"
BEGIN="# >>> dsh-plugins: GitHub 专用（由 tools/setup-github-ssh.sh 维护）>>>"
END="# <<< dsh-plugins: GitHub 专用 <<<"
DEFAULT_DIR="$HOME/Code/github/dsh-plugins"

DIR=""
DO_CLONE=1
ASSUME_YES=0

say()  { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
warn() { printf '!!  %s\n' "$*" >&2; }
die()  { printf 'xx  %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  awk 'NR > 1 { if ($0 == "set -u") exit; sub(/^# ?/, ""); print }' "$0"
  exit 0
}

open_url() {
  if have open; then open "$1" >/dev/null 2>&1 && return 0; fi
  if have xdg-open; then xdg-open "$1" >/dev/null 2>&1 && return 0; fi
  if have explorer.exe; then explorer.exe "$1" >/dev/null 2>&1 && return 0; fi
  return 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--dir)      shift; [ $# -gt 0 ] || die "--dir 后面要给路径"; DIR="$1" ;;
    -n|--no-clone) DO_CLONE=0 ;;
    -y|--yes)      ASSUME_YES=1 ;;
    -h|--help)     usage ;;
    -*)            die "未知选项：$1（-h 看帮助）" ;;
    *)             DIR="$1" ;;
  esac
  shift
done
[ -n "$DIR" ] || DIR="$DEFAULT_DIR"

have ssh || die "找不到 ssh"
have ssh-keygen || die "找不到 ssh-keygen"
have git || die "找不到 git（macOS 上装 Xcode Command Line Tools：xcode-select --install）"

# ---------------------------------------------------------------------------
# 1. 目录 + 密钥
# ---------------------------------------------------------------------------
step "检查 ~/.ssh 与专用密钥"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ -f "$KEY" ]; then
  say "  已存在，复用：$KEY"
else
  ssh-keygen -t ed25519 -N "" -C "279347515@qq.com" -f "$KEY" -q || die "生成密钥失败"
  say "  已生成：${KEY}（无口令；想加密钥就跑 ssh-keygen -p -f ${KEY}）"
fi
chmod 600 "$KEY"
[ -f "$KEY.pub" ] || die "缺少公钥文件 $KEY.pub"

# ---------------------------------------------------------------------------
# 2. ~/.ssh/config 里那段托管配置
# ---------------------------------------------------------------------------
step "维护 ~/.ssh/config 的 dsh-plugins 段（段外不动）"
TMP="$CFG.dsh-tmp.$$"
if [ -f "$CFG" ]; then
  # 按前缀匹配起止标记：手工写过、措辞不同的旧段也能整段替换，不会堆成两份
  awk '
    /^# >>> dsh-plugins:/ { skip = 1; next }
    /^# <<< dsh-plugins:/ { skip = 0; next }
    skip != 1 { print }
  ' "$CFG" > "$TMP" || die "处理 $CFG 失败"
else
  : > "$TMP"
fi
# 去掉尾部空行，免得反复执行越积越多
awk '{ line[NR] = $0 } END { last = NR; while (last > 0 && line[last] ~ /^[[:space:]]*$/) last--; for (i = 1; i <= last; i++) print line[i] }' "$TMP" > "$TMP.trim"
mv "$TMP.trim" "$TMP"
{
  printf '\n%s\n' "$BEGIN"
  printf '# 公司网络常把 github.com:22 掐掉（TCP 连得上、SSH 握手被断），所以走 GitHub\n'
  printf '# 官方的 443 通道。remote 仍然写 git@github.com:owner/repo.git，用法不变；\n'
  printf '# 哪天 22 可用又想直连，用别名 git@github-22:owner/repo.git。\n'
  printf 'Host github.com\n'
  printf '  HostName ssh.github.com\n'
  printf '  Port 443\n'
  printf '  User git\n'
  printf '  IdentityFile %s\n' "$KEY"
  printf '  IdentitiesOnly yes\n'
  printf '\n'
  printf 'Host github-22\n'
  printf '  HostName github.com\n'
  printf '  Port 22\n'
  printf '  User git\n'
  printf '  IdentityFile %s\n' "$KEY"
  printf '  IdentitiesOnly yes\n'
  printf '%s\n' "$END"
} >> "$TMP"
chmod 600 "$TMP"
if [ -f "$CFG" ] && cmp -s "$CFG" "$TMP"; then
  rm -f "$TMP"
  say "  已是最新，未改动"
else
  [ -f "$CFG" ] || say "  新建 $CFG"
  mv "$TMP" "$CFG"
  say "  已更新 $CFG 里的 dsh-plugins 段"
fi

# ---------------------------------------------------------------------------
# 3. 公钥登记 + 验证
# ---------------------------------------------------------------------------
# 0 = 认证通过；1 = 到了 GitHub 但公钥没登记；2 = 网络没通
# 钉死用我们这把 key（IdentityAgent=none + -i + IdentitiesOnly）：否则 ssh-agent
# 里恰好有别的 GitHub key 时会「认证通过」，等重启后 agent 空了推送又挂。
probe() {
  OUT=$(ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new \
            -o IdentityAgent=none -o IdentitiesOnly=yes -i "$KEY" \
            -T git@github.com 2>&1 | head -n 2)
  case "$OUT" in
    *"successfully authenticated"*) printf '%s\n' "$OUT" | head -n 1; return 0 ;;
    *"Permission denied"*)         return 1 ;;
    *)                             return 2 ;;
  esac
}

step "验证 SSH 认证"
AUTH_OK=0
if probe; then
  say "  ✔ 已认证"
  AUTH_OK=1
else
  rc=$?
  say ""
  say "  公钥（贴到 $KEYS_URL → New SSH key，Key type 选 Authentication Key）："
  say ""
  say "    $(cat "$KEY.pub")"
  say ""
  say "  指纹：$(ssh-keygen -lf "$KEY.pub" 2>/dev/null | awk '{print $2}')"
  say ""
  if [ "$rc" -eq 2 ]; then
    warn "没连上 GitHub：${OUT:-连接失败}"
    warn "443 也被挡的话，试试别名 git@github-22:… 或换网络"
  else
    open_url "$KEYS_URL" && say "  已尝试打开 GitHub 的 SSH key 页面"
  fi
  if [ "$rc" -eq 1 ] && [ "$ASSUME_YES" -eq 0 ] && [ -t 0 ]; then
    tries=0
    while [ "$tries" -lt 3 ]; do
      printf '  贴好后按回车继续（Ctrl-C 放弃）：'
      read -r _ || break
      sleep 1
      if probe; then say "  ✔ 已认证"; AUTH_OK=1; break; fi
      tries=$((tries + 1))
      warn "这次还没通过（刚添加可能要等几秒）"
    done
  fi
fi

# ---------------------------------------------------------------------------
# 4. clone / 更新仓库，并把 origin 指向 SSH
# ---------------------------------------------------------------------------
if [ "$DO_CLONE" -eq 1 ]; then
  step "准备仓库：$DIR"
  if [ -d "$DIR/.git" ]; then
    git -C "$DIR" remote set-url origin "$REPO_SSH"
    say "  已是 git 仓库，origin 已指向 SSH；拉取最新…"
    if GIT_TERMINAL_PROMPT=0 git -C "$DIR" fetch --prune origin; then
      git -C "$DIR" pull --ff-only || warn "快进失败（本地有新提交？），稍后自己 git pull"
    else
      warn "拉取失败，稍后自己 git pull"
    fi
  elif [ -e "$DIR" ]; then
    warn "$DIR 已存在但不是 git 仓库，跳过 clone"
  else
    mkdir -p "$(dirname "$DIR")"
    if [ "$AUTH_OK" -eq 1 ]; then
      say "  clone 中（SSH）…"
      GIT_TERMINAL_PROMPT=0 git clone "$REPO_SSH" "$DIR" || die "clone 失败"
    else
      # 公钥还没生效也先让你拿到代码：公开仓库匿名 HTTPS clone，再把 origin 指到 SSH
      say "  clone 中（HTTPS，公钥生效前先拿到代码）…"
      GIT_TERMINAL_PROMPT=0 git -c credential.helper= clone "$REPO_HTTPS" "$DIR" || die "clone 失败"
      git -C "$DIR" remote set-url origin "$REPO_SSH"
      say "  origin 已指向 SSH：公钥登记后 git push 即可用"
    fi
  fi
  say "  仓库就绪：$DIR"
fi

# ---------------------------------------------------------------------------
# 5. 下一步
# ---------------------------------------------------------------------------
if [ "$AUTH_OK" -eq 1 ]; then
  step "搞定，后面都用 SSH 推，不会再要凭据"
else
  step "本地已配好，还差一步：把上面的公钥加到 GitHub，然后重跑本脚本"
fi
say "  自检：      ssh -T git@github.com"
say "  日常推送：  git push"
say "  核对远端：  git remote -v"
say ""
say "  建议顺手设一次提交身份（用 GitHub 账号绑定的邮箱，提交才会挂在你的头像下）："
say "    git config --global user.name \"程朗\""
say "    git config --global user.email 279347515@qq.com"
if [ "$DO_CLONE" -eq 1 ] && [ -d "$DIR/.git" ]; then
  say ""
  say "  把这批插件装进本机 Harness（bundle 形态要求 dsh >= 0.2.0-rc.2）："
  say "    python3 ~/.dsh/skills/dsh-plugin-install/scripts/install_plugin.py \"$DIR\" --profile desktop   # 或 --profile web"
  say "  或者：设置 → 插件 → 批量安装 → 选 \"$DIR\" → 全选 → 安装选中"
fi
say ""
say "  换机 / 重复执行：再跑一次本脚本即可，已完成的步骤会自动跳过。"

[ "$AUTH_OK" -eq 1 ] || exit 1
