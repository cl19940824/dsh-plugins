#!/usr/bin/env bash
#
# dsh-plugins —— 本机 GitHub SSH 配置（非交互；跑完就能在 SourceTree 里 clone / commit / push）
#
#   bash tools/setup-github-ssh.sh [选项]
#
# 干三件事，全部幂等、全程不需要你输入任何东西：
#   1. 生成这台机器自己的 GitHub 专用 ed25519 密钥（~/.ssh/id_ed25519_github；
#      已存在就复用，绝不覆盖私钥）
#   2. 在 ~/.ssh/config 里维护一段带标记的配置：github.com 走 GitHub 官方
#      ssh.github.com:443（公司网络常把 22 端口掐掉），另留 github-22 直连别名；
#      标记段以外的内容一个字都不动
#   3. 把公钥复制到剪贴板并打印出来，然后当场验证（分两步：先只试这把 key
#      确认它真的被 GitHub 接受，再检查 ssh 实际解析出来的配置是不是我们要的）
#
# 边界（给别人跑也安全）：
#   * 只写 ~/.ssh 和 --dir 指定的新目录；不 sudo、不装包、不联网取任何东西、无埋点
#   * 从不读私钥内容，只读 .pub；私钥只在本机生成，不会外传
#   * ~/.ssh/config 是符号链接（dotfiles）时**拒绝改动**，只把该加的片段打给你
#   * 已有别的 `Host github.com` 段时只警告（SSH 先出现的值优先），不抢你的设置
#   * --dir 指向已存在的仓库时，只有当它的 origin 本来就是本仓库才动；否则只提示
#
# 选项：
#   -d, --dir <路径>  顺便把仓库 clone / 更新到该路径（不给就完全不动你的工作区）
#       --repo <地址> 覆盖仓库 SSH 地址（默认 git@github.com:cl19940824/dsh-plugins.git）
#       --no-copy     不往剪贴板复制公钥
#   -h, --help        看帮助
#
# 退出码：0 = 已能推送；1 = 还差把公钥贴到 GitHub（或需要你手工合并配置）；2 = 连不上 GitHub
#
set -u

REPO_SSH="git@github.com:cl19940824/dsh-plugins.git"
KEYS_URL="https://github.com/settings/keys"
KEY="$HOME/.ssh/id_ed25519_github"
CFG="$HOME/.ssh/config"
BEGIN="# >>> dsh-plugins: GitHub 专用（由 tools/setup-github-ssh.sh 维护）>>>"
END="# <<< dsh-plugins: GitHub 专用 <<<"

DIR=""
DO_COPY=1

say()  { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
warn() { printf '!!  %s\n' "$*" >&2; }
die()  { printf 'xx  %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  awk 'NR > 1 { if ($0 == "set -u") exit; sub(/^# ?/, ""); print }' "$0"
  exit 0
}

# 剪贴板：macOS / Wayland / X11 / Git Bash 各来一手，失败也不算错
copy_clip() {
  if have pbcopy;   then printf '%s' "$1" | pbcopy && return 0; fi
  if have wl-copy;  then printf '%s' "$1" | wl-copy && return 0; fi
  if have xclip;    then printf '%s' "$1" | xclip -selection clipboard && return 0; fi
  if have clip.exe; then printf '%s' "$1" | clip.exe && return 0; fi
  return 1
}

# ssh 地址 → 匿名 https 地址（公开仓库在公钥生效前也能先 clone）
https_of() {
  case "$1" in
    git@*:*)  host=${1#git@}; host=${host%%:*}; path=${1#*:}; printf 'https://%s/%s\n' "$host" "$path" ;;
    ssh://*)  printf '%s\n' "$1" | sed -E 's#^ssh://([^@/]+@)?([^/]+)/#https://\2/#' ;;
    *)        printf '%s\n' "$1" ;;
  esac
}

# 要写进 ~/.ssh/config 的那一段（同时用于手工合并提示）
block() {
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
}

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--dir)   shift; [ $# -gt 0 ] || die "--dir 后面要给路径"; DIR="$1" ;;
    --repo)     shift; [ $# -gt 0 ] || die "--repo 后面要给地址"; REPO_SSH="$1" ;;
    --no-copy)  DO_COPY=0 ;;
    -h|--help)  usage ;;
    -*)         die "未知选项：$1（-h 看帮助）" ;;
    *)          DIR="$1" ;;
  esac
  shift
done

have ssh || die "找不到 ssh"
have ssh-keygen || die "找不到 ssh-keygen"
[ "$(id -u)" -eq 0 ] && warn "当前是 root，会写到 /root/.ssh —— 通常不是你要的，换普通用户跑"

# ---------------------------------------------------------------------------
# 1. 密钥
# ---------------------------------------------------------------------------
step "GitHub 专用密钥"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
if [ -f "$KEY" ]; then
  say "  已存在，复用：${KEY}"
else
  # 注释用你自己的 git 邮箱（拿不到就用 用户@主机），不写死任何人的邮箱
  KEY_COMMENT=$(git config --get user.email 2>/dev/null || true)
  [ -n "$KEY_COMMENT" ] || KEY_COMMENT="$(id -un)@$(hostname 2>/dev/null || printf 'localhost')"
  ssh-keygen -t ed25519 -N "" -C "$KEY_COMMENT" -f "$KEY" -q || die "生成密钥失败"
  say "  已生成：${KEY}（无口令；想加密钥就跑 ssh-keygen -p -f ${KEY}）"
fi
if [ -L "$KEY" ]; then
  warn "$KEY 是符号链接，跳过 chmod（不动它指向的文件权限）"
else
  chmod 600 "$KEY"
fi
[ -f "$KEY.pub" ] || die "缺少公钥文件 $KEY.pub"

# ---------------------------------------------------------------------------
# 2. ~/.ssh/config 里那段托管配置
# ---------------------------------------------------------------------------
step "维护 ~/.ssh/config 的 dsh-plugins 段（段外不动）"
MERGE_MANUAL=0
if [ -L "$CFG" ]; then
  # dotfiles 场景：不动符号链接，只把片段打出来让人自己合
  MERGE_MANUAL=1
  warn "$CFG 是符号链接（dotfiles？），本脚本不替换它"
  say "  请把下面这段加进你真正的配置文件里（一般在 dotfiles 仓库）："
  block
else
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
  # 标记段以外若已有 Host github.com，SSH 会用「先出现的值」，我们的段可能被顶掉
  FOREIGN=$(awk '
    /^# >>> dsh-plugins:/ { skip = 1 }
    /^# <<< dsh-plugins:/ { skip = 0; next }
    skip != 1 && tolower($1) == "host" {
      for (i = 2; i <= NF; i++) if ($i ~ /github\.com/) { print NR; break }
    }
  ' "$TMP")
  # 去掉尾部空行，免得反复执行越积越多
  awk '{ line[NR] = $0 } END { last = NR; while (last > 0 && line[last] ~ /^[[:space:]]*$/) last--; for (i = 1; i <= last; i++) print line[i] }' "$TMP" > "$TMP.trim"
  mv "$TMP.trim" "$TMP"
  block >> "$TMP"
  chmod 600 "$TMP"
  if [ -f "$CFG" ] && cmp -s "$CFG" "$TMP"; then
    rm -f "$TMP"
    say "  已是最新，未改动"
  else
    [ -f "$CFG" ] || say "  新建 $CFG"
    mv "$TMP" "$CFG"
    say "  已更新 $CFG 里的 dsh-plugins 段"
  fi
  if [ -n "$FOREIGN" ]; then
    warn "$CFG 第 $FOREIGN 行已有别的 Host github.com 段；SSH 只取先出现的值，"
    warn "本脚本这段可能不生效。建议把下面这段挪到你那个段之前，或手工合并："
    block
  fi
fi

# ---------------------------------------------------------------------------
# 3. 验证（两件事分开查，避免假阳性）
# ---------------------------------------------------------------------------
# 3a. 只试我们这把 key、只走 443：-F /dev/null 甩掉 ~/.ssh/config 与 ssh-agent，
#     否则「本机恰好有别的已登记 GitHub key」时会误报通过。
#     0 = 通过；1 = 到了 GitHub 但公钥没登记；2 = 网络没通
probe() {
  OUT=$(ssh -F /dev/null -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new \
            -o HostName=ssh.github.com -o Port=443 -o User=git \
            -o IdentityAgent=none -o IdentitiesOnly=yes -i "$KEY" \
            -T git@github.com 2>&1 | head -n 2)
  case "$OUT" in
    *"successfully authenticated"*) printf '%s\n' "$OUT" | head -n 1; return 0 ;;
    *"Permission denied"*)         return 1 ;;
    *)                             return 2 ;;
  esac
}

step "验证"
AUTH_RC=0
probe || AUTH_RC=$?
PUBKEY=$(cat "$KEY.pub")

if [ "$AUTH_RC" -eq 0 ]; then
  say "  ✔ 这把 key 已被 GitHub 接受"
else
  if [ "$AUTH_RC" -eq 1 ]; then
    say "  还差一步：把下面这行公钥贴到 GitHub → 然后重跑本脚本（其余步骤会自动跳过）"
  else
    say "  没连上 GitHub：${OUT:-连接失败}（443 也被挡的话换网络，或用别名 git@github-22:…）"
  fi
  say ""
  say "  公钥："
  say "    $PUBKEY"
  say "  指纹：$(ssh-keygen -lf "$KEY.pub" 2>/dev/null | awk '{print $2}')"
  if [ "$DO_COPY" -eq 1 ]; then
    if copy_clip "$PUBKEY"; then
      say "  （已复制到剪贴板，直接去 $KEYS_URL 粘贴 → Key type 选 Authentication Key）"
    else
      say "  （没能复制到剪贴板，手动复制上面那行）"
    fi
  fi
  say ""
  say "  页面：$KEYS_URL"
fi

# 3b. ssh 实际解析出来的 github.com 是什么（顺手暴露「被别的段顶掉」的情况）
if [ "$MERGE_MANUAL" -eq 0 ] && [ -f "$CFG" ]; then
  EFF=$(ssh -F "$CFG" -G github.com 2>/dev/null | awk '
    tolower($1) == "hostname"     { if (h == "") h = $2 }
    tolower($1) == "port"         { if (p == "") p = $2 }
    tolower($1) == "identityfile" { if (i == "") i = $2 }
    END { printf "%s %s %s\n", h, p, i }
  ')
  EFF_HOST=$(printf '%s\n' "$EFF" | cut -d' ' -f1)
  EFF_PORT=$(printf '%s\n' "$EFF" | cut -d' ' -f2)
  EFF_ID=$(basename "$(printf '%s\n' "$EFF" | cut -d' ' -f3)")
  if [ "$EFF_HOST" = "ssh.github.com" ] && [ "$EFF_PORT" = "443" ] && [ "$EFF_ID" = "$(basename "$KEY")" ]; then
    say "  ✔ ssh 解析 github.com → ssh.github.com:443，用 $(basename "$KEY")"
  else
    warn "ssh 实际解析：${EFF_HOST:-?}:${EFF_PORT:-?} / ${EFF_ID:-?}，不是本脚本那段 —— 多半被前面的 Host github.com 段顶掉了，请手工合并"
  fi
fi

# ---------------------------------------------------------------------------
# 4. 可选：顺手 clone / 更新仓库（只在给了 --dir 时做）
# ---------------------------------------------------------------------------
if [ -n "$DIR" ]; then
  step "仓库：$DIR"
  ORIGIN=""
  if [ -d "$DIR/.git" ]; then
    ORIGIN=$(git -C "$DIR" remote get-url origin 2>/dev/null || true)
  fi
  case "${ORIGIN:-$REPO_SSH}" in
    "$REPO_SSH"|"$(https_of "$REPO_SSH")"|"")
      if [ -d "$DIR/.git" ]; then
        git -C "$DIR" remote set-url origin "$REPO_SSH"
        say "  已是 git 仓库，origin 已指向 SSH；拉取最新…"
        if GIT_TERMINAL_PROMPT=0 git -C "$DIR" fetch --prune origin; then
          git -C "$DIR" pull --ff-only || warn "快进失败（本地有新提交？），稍后自己 git pull"
        else
          warn "拉取失败，稍后自己 git pull"
        fi
      elif [ -e "$DIR" ]; then
        warn "$DIR 已存在但不是 git 仓库，跳过"
      else
        mkdir -p "$(dirname "$DIR")"
        if [ "$AUTH_RC" -eq 0 ]; then
          say "  clone 中（SSH）…"
          GIT_TERMINAL_PROMPT=0 git clone "$REPO_SSH" "$DIR" || die "clone 失败"
        else
          # 公钥还没生效也先让你拿到代码：公开仓库匿名 HTTPS clone，再把 origin 指到 SSH
          say "  clone 中（HTTPS，公钥生效前先拿到代码）…"
          GIT_TERMINAL_PROMPT=0 git -c credential.helper= clone "$(https_of "$REPO_SSH")" "$DIR" || die "clone 失败"
          git -C "$DIR" remote set-url origin "$REPO_SSH"
          say "  origin 已指向 SSH"
        fi
      fi
      say "  仓库就绪：$DIR"
      ;;
    *)
      # 别人的仓库：绝不偷偷改 remote
      warn "$DIR 是已有仓库，但 origin 是 ${ORIGIN}（不是本仓库），为免动别人的远程，跳过"
      say "  想改的话自己跑：git -C \"$DIR\" remote set-url origin $REPO_SSH"
      ;;
  esac
fi

# ---------------------------------------------------------------------------
# 5. 下一步（SourceTree 用法）
# ---------------------------------------------------------------------------
step "下一步"
if [ "$AUTH_RC" -eq 0 ] && [ "$MERGE_MANUAL" -eq 0 ]; then
  say "  SourceTree 里直接用 SSH 地址，提交 / 推送一律走按钮，不会再要账号密码："
else
  say "  贴完公钥 / 合并好配置、重跑本脚本看到两个 ✔ 之后："
fi
say "    clone：  仓库 → 新建 → 克隆，源地址填 $REPO_SSH"
say "    已有仓库：仓库设置 → 远程仓库 → URL 改成 $REPO_SSH"
say "    前提：   SourceTree → 设置 → 通用 → SSH 客户端 = OpenSSH（macOS 默认就是）"
say "    那个报错上不去的 GitHub HTTPS 账号可以留着不管，也可以删掉（SSH 用不到它）"
say ""
say "  命令行自检：ssh -T git@github.com"
if have python3 && [ -f "$HOME/.dsh/skills/dsh-plugin-install/scripts/install_plugin.py" ]; then
  say "  装插件：python3 ~/.dsh/skills/dsh-plugin-install/scripts/install_plugin.py <仓库路径> --profile desktop   # 或 --profile web"
  say "          或者：设置 → 插件 → 批量安装 → 选仓库文件夹 → 全选 → 安装选中"
fi
say ""
say "  再跑一次本脚本 = 幂等复检（已完成的步骤自动跳过）"

[ "$AUTH_RC" -eq 0 ] || exit "$AUTH_RC"
[ "$MERGE_MANUAL" -eq 1 ] && exit 1
exit 0
