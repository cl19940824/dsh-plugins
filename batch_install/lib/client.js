/**
 * dsh-batch-install —— 浏览器半边。
 *
 * 两个入口，共用同一套面板：
 *   1. 设置 → 插件 →「批量安装」标签页（plugins.tab）
 *   2. 设置 → 插件 →「添加」菜单里的「从文件夹安装…」一行（plugins.add.actions），
 *      点开后是同一个面板的浮层版本
 *
 * 面板只做三件事：选文件夹（走 dsh 自带的原生目录选择器）、扫描出里面的插件、
 * 勾选后逐个调用插件管理器自己的 `remote.pluginManager.installBundle`。
 * 也就是说，安装仍然由 dsh 官方那条通道完成（pnpm + profile 清单 + bundle 选中 +
 * HMR 重组合），本插件不写任何 profile 文件。
 */

window.__ModuleLoader__.load({
  id: 'dsh-batch-install',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /** 本插件的字典命名空间。 */
    const NS = 'batchInstall'
    /** 宿主半边提供的扫描接口。 */
    const SCAN_URL = '/api/plugin-batch.scan'
    /** 本插件注册的槽位 id。 */
    const SLOT_ID = 'batch-install'

    const zh = {
      tab: '批量安装',
      title: '从文件夹批量安装本地插件',
      sub: '选一个文件夹，自动找出里面的 dsh 插件（package.json 里的 dsh.bundle.patch，或旧的 manifest.json），勾选后一次装完。安装走 dsh 自带的插件管理器，和「添加」里装本地目录完全一样。',
      pickFolder: '选择文件夹…',
      picking: '正在打开文件夹选择器…',
      rescan: '重新扫描',
      scanning: '扫描中…',
      noFolder: '还没选文件夹',
      scanFailed: '扫描失败',
      pickFailed: '打开文件夹选择器失败',
      noPicker: '当前部署没有可用的目录选择器（需要在桌面端或本机浏览器里使用）',
      found: '找到 {count} 个插件',
      installable: '其中 {count} 个可安装',
      selected: '已选 {count}',
      selectAll: '全选',
      clear: '清空',
      install: '安装选中（{count}）',
      installing: '正在安装 {index}/{total}',
      installedHere: '已安装（本目录）',
      installedElsewhere: '已安装（其他来源）',
      legacyTag: '旧形态 · 不能批量安装',
      noClientTag: '无浏览器半边',
      statusRunning: '安装中…',
      statusDone: '已安装',
      statusRestart: '需重启服务',
      statusFailed: '失败',
      needRestart: '改动了启动时加载的模块，重启服务后生效',
      summary: '本次：成功 {ok} · 需重启 {restart} · 失败 {failed}',
      allDone: '全部安装完成',
      skipped: '已跳过 {count} 个非插件目录',
      truncated: '目录太大，只扫描了前若干个条目',
      empty: '这个文件夹里没找到插件包',
      emptyHint: '如果插件源码在子目录里，请选择包含这些子目录的上一级文件夹，或直接选中某个插件目录。',
      log: '最近输出',
      close: '关闭',
      viewInstalled: '查看已安装',
      reload: '刷新安装状态',
      unmanagedHint: '当前部署没有可管理的 profile，无法安装插件。',
      alreadyInstalled: '这个插件已经装过了',
      notBundle: '这个包没有 dsh.bundle.patch，插件管理器装不了',
      invalidSpec: '路径不可用',
      incompatible: 'DSH 版本不满足该插件要求',
      unknownFail: '安装失败',
      menuTitle: '从文件夹安装…',
      menuDesc: '不用手输路径：选一个文件夹，批量勾选安装里面的插件',
    }

    const en = {
      tab: 'Batch install',
      title: 'Install local plugins from a folder',
      sub: 'Pick a folder and every dsh plugin inside it (package.json with dsh.bundle.patch, or a legacy manifest.json) is listed. Tick the ones you want and install them in one go — through the same plugin manager the Add dialog uses.',
      pickFolder: 'Choose folder…',
      picking: 'Opening the folder chooser…',
      rescan: 'Rescan',
      scanning: 'Scanning…',
      noFolder: 'No folder chosen yet',
      scanFailed: 'Scan failed',
      pickFailed: 'Could not open the folder chooser',
      noPicker: 'This deployment has no directory picker (needs the desktop app or a local browser)',
      found: '{count} plugins found',
      installable: '{count} installable',
      selected: '{count} selected',
      selectAll: 'Select all',
      clear: 'Clear',
      install: 'Install selected ({count})',
      installing: 'Installing {index}/{total}',
      installedHere: 'Installed (this folder)',
      installedElsewhere: 'Installed (other source)',
      legacyTag: 'Legacy form · not batch-installable',
      noClientTag: 'No browser half',
      statusRunning: 'Installing…',
      statusDone: 'Installed',
      statusRestart: 'Restart required',
      statusFailed: 'Failed',
      needRestart: 'It replaces a module loaded at startup; restart the service to apply',
      summary: 'This run: {ok} ok · {restart} need restart · {failed} failed',
      allDone: 'All installations finished',
      skipped: 'Skipped {count} non-plugin folders',
      truncated: 'The folder is large; only the first entries were scanned',
      empty: 'No plugin package found in this folder',
      emptyHint: 'If the sources live in subfolders of a subfolder, pick their parent folder instead, or pick one plugin directory directly.',
      log: 'Recent output',
      close: 'Close',
      viewInstalled: 'View installed',
      reload: 'Refresh install state',
      unmanagedHint: 'This deployment has no manageable profile, so plugins cannot be installed.',
      alreadyInstalled: 'This plugin is already installed',
      notBundle: 'The package declares no dsh.bundle.patch, so the plugin manager cannot install it',
      invalidSpec: 'Unusable path',
      incompatible: 'The plugin requires a different DSH version',
      unknownFail: 'Install failed',
      menuTitle: 'Install from folder…',
      menuDesc: 'No path typing: pick a folder and install its plugins in batch',
    }

    const CSS = [
      '.dshb-root{display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.6}',
      '.dshb-title{margin:0;font-size:14px;font-weight:600}',
      '.dshb-sub{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dshb-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dshb-grow{flex:1 1 auto}',
      '.dshb-btn{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1,rgba(22,32,58,.14));border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#1b2130);font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:border-color .15s ease,background .15s ease}',
      '.dshb-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l2,rgba(22,32,58,.28));background:var(--dsw-alias-bg-layer-2,rgba(22,32,58,.04))}',
      '.dshb-btn:disabled{opacity:.5;cursor:not-allowed}',
      // 实心按钮的取色只走 dsh 自己的「实心/反白」配对：
      // 暗色主题下 --dsw-alias-brand-primary 是近白、亮色主题下是近黑，
      // 与之配对的文字色是 --dsw-alias-label-primary-inverted。
      // 千万别写死 color:#fff —— 暗色主题下就是白底白字。
      '.dshb-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff);font-weight:600}',
      '.dshb-btn-primary:hover:not(:disabled){opacity:.88}',
      '.dshb-path{font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#5b6478);background:var(--dsw-alias-bg-layer-2,rgba(22,32,58,.05));padding:4px 9px;border-radius:7px;max-width:100%;word-break:break-all}',
      '.dshb-note{font-size:11px;color:var(--dsw-alias-label-secondary,#5b6478)}',
      '.dshb-err{margin:0;font-size:12px;color:var(--dsw-alias-state-error-primary,#d23b3b)}',
      '.dshb-list{display:flex;flex-direction:column;gap:6px;max-height:min(50vh,420px);overflow:auto;padding:2px}',
      '.dshb-row{display:flex;align-items:flex-start;gap:10px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l1,rgba(22,32,58,.12));border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent)}',
      '.dshb-row.is-done{border-color:var(--dsw-alias-state-success-primary,#1f9d55)}',
      '.dshb-row.is-restart{border-color:var(--dsw-alias-state-warn-primary,#c07a1a)}',
      '.dshb-row.is-failed{border-color:var(--dsw-alias-state-error-primary,#d23b3b)}',
      // 勾选框交给浏览器按 color-scheme 画，别自己指定 accent-color（暗色下会白对白）
      '.dshb-check{margin:3px 0 0;flex:none}',
      '.dshb-main{flex:1 1 auto;min-width:0}',
      '.dshb-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-weight:600;word-break:break-all}',
      '.dshb-ver{font-weight:400;font-size:11px;color:var(--dsw-alias-label-secondary,#5b6478);font-variant-numeric:tabular-nums}',
      '.dshb-desc{margin-top:2px;font-size:12px;color:var(--dsw-alias-label-secondary,#5b6478);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.dshb-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}',
      '.dshb-tag{font-size:11px;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(22,32,58,.06));color:var(--dsw-alias-label-secondary,#5b6478)}',
      '.dshb-tag.ok{color:var(--dsw-alias-state-success-primary,#1f9d55)}',
      '.dshb-tag.warn{color:var(--dsw-alias-state-warn-primary,#c07a1a)}',
      '.dshb-status{flex:none;max-width:34%;text-align:right;font-size:11px;color:var(--dsw-alias-label-secondary,#5b6478);padding-top:3px;word-break:break-word}',
      '.dshb-status.is-done{color:var(--dsw-alias-state-success-primary,#1f9d55)}',
      '.dshb-status.is-restart{color:var(--dsw-alias-state-warn-primary,#c07a1a)}',
      '.dshb-status.is-failed{color:var(--dsw-alias-state-error-primary,#d23b3b)}',
      '.dshb-empty{padding:26px 4px;text-align:center;color:var(--dsw-alias-label-secondary,#5b6478);font-size:12px;line-height:1.9}',
      '.dshb-sum{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,rgba(22,32,58,.05));font-size:12px}',
      '.dshb-log{margin:0;max-height:120px;overflow:auto;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary,#5b6478);background:var(--dsw-alias-bg-layer-2,rgba(22,32,58,.05));border-radius:8px;padding:8px 10px}',
      '.dshb-menuRow{display:flex;flex-direction:column;gap:2px;width:100%;box-sizing:border-box;min-height:72px;justify-content:center;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary,#1b2130);font:inherit;text-align:left;cursor:pointer}',
      '.dshb-menuRow:hover,.dshb-menuRow:focus-visible{background:var(--dsw-alias-bg-layer-2,rgba(22,32,58,.06));outline:none}',
      '.dshb-menuTitle{font-size:13px;font-weight:600}',
      '.dshb-menuDesc{font-size:12px;color:var(--dsw-alias-label-secondary,#5b6478);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      // shell.overlay 那一层本身是 click-through（pointer-events:none），
      // 所以自己的浮层必须显式 opt-in，否则点不到。
      '.dshb-mask{position:fixed;inset:0;z-index:9600;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(12,18,32,.42);pointer-events:auto}',
      '.dshb-modal{box-sizing:border-box;width:min(760px,100%);max-height:min(86vh,780px);overflow:auto;padding:16px 20px 14px;border:1px solid var(--dsw-alias-border-l1,rgba(22,32,58,.12));border-radius:16px;background:var(--dsw-alias-bg-overlay,#fff);box-shadow:0 24px 60px rgba(12,18,32,.28);pointer-events:auto}',
      '.dshb-modalHead{display:flex;align-items:flex-start;gap:10px}',
      '.dshb-modalHead .dshb-close{margin-left:auto;flex:none}',
    ].join('')

    /** 极简快照 store：状态活在 apply 的闭包里，切标签页 / 开关浮层都不丢。 */
    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        get: () => state,
        set(patch) {
          state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
          for (const listener of [...listeners]) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    /** apply() 在挂载时把 store / actions / t 放进来，组件从这里读。 */
    const view = { store: null, actions: null, t: (key) => key }

    /** 订阅 store 的 hook（不依赖 useSyncExternalStore，React 17/18 都能跑）。 */
    function useSnapshot() {
      const store = view.store
      const [snapshot, setSnapshot] = React.useState(() => store.get())
      React.useEffect(() => {
        setSnapshot(store.get())
        return store.subscribe(() => setSnapshot(store.get()))
      }, [store])
      return snapshot
    }

    /** 卸载后不再 setState（异步动作可能比组件活得久）。 */
    function messageOf(error) {
      if (error && typeof error === 'object' && typeof error.message === 'string') return error.message
      return String(error ?? '')
    }

    function dirOfSpec(spec) {
      if (typeof spec !== 'string') return null
      return spec.replace(/^(?:file|link):/, '').replace(/\/+$/, '')
    }

    function formatRow(snapshot, row, t) {
      if (row.status === 'running') return t('statusRunning')
      if (row.status === 'done') return t('statusDone')
      if (row.status === 'restart') return t('statusRestart')
      if (row.status === 'failed') return row.message || t('statusFailed')
      return ''
    }

    function rowClass(row) {
      return 'dshb-row' + (row.status === 'done' ? ' is-done' : '') + (row.status === 'restart' ? ' is-restart' : '') + (row.status === 'failed' ? ' is-failed' : '')
    }

    function statusClass(row) {
      return 'dshb-status' + (row.status === 'done' ? ' is-done' : '') + (row.status === 'restart' ? ' is-restart' : '') + (row.status === 'failed' ? ' is-failed' : '')
    }

    /** 面板本体：标签页与浮层共用。 */
    function Panel(props) {
      const t = view.t
      const actions = view.actions
      const snapshot = useSnapshot()
      const rows = snapshot.rows
      const selected = rows.filter((row) => row.selected).length
      const installable = rows.filter((row) => row.installable && !row.installed).length

      const list = rows.length
        ? h(
            'div',
            { className: 'dshb-list' },
            rows.map((row) =>
              h(
                'label',
                { className: rowClass(row), key: row.key },
                h('input', {
                  type: 'checkbox',
                  className: 'dshb-check',
                  checked: row.selected,
                  disabled: !row.installable || row.installed || snapshot.installing,
                  onChange: (event) => actions.toggle(row.key, event.target.checked),
                }),
                h(
                  'div',
                  { className: 'dshb-main' },
                  h(
                    'div',
                    { className: 'dshb-name' },
                    row.name,
                    row.version ? h('span', { className: 'dshb-ver' }, `v${row.version}`) : null,
                  ),
                  row.description ? h('div', { className: 'dshb-desc' }, row.description) : null,
                  h(
                    'div',
                    { className: 'dshb-tags' },
                    row.installed
                      ? h('span', { className: 'dshb-tag ok' }, row.installedHere ? t('installedHere') : t('installedElsewhere'))
                      : null,
                    !row.installable ? h('span', { className: 'dshb-tag warn' }, t('legacyTag')) : null,
                    row.installable && !row.hasClient ? h('span', { className: 'dshb-tag' }, t('noClientTag')) : null,
                    h('span', { className: 'dshb-tag', title: row.path }, row.folder),
                  ),
                ),
                h('div', { className: statusClass(row) }, formatRow(snapshot, row, t)),
              ),
            ),
          )
        : null

      const progress = snapshot.progress

      return h(
        'div',
        { className: 'dshb-root' },
        props.variant === 'modal'
          ? h(
              'div',
              { className: 'dshb-modalHead' },
              h('div', null, h('h2', { className: 'dshb-title' }, t('title')), h('p', { className: 'dshb-sub' }, t('sub'))),
              h('button', { type: 'button', className: 'dshb-btn dshb-close', onClick: props.onClose }, t('close')),
            )
          : h('header', null, h('h2', { className: 'dshb-title' }, t('title')), h('p', { className: 'dshb-sub' }, t('sub'))),

        snapshot.unmanaged ? h('p', { className: 'dshb-err' }, t('unmanagedHint')) : null,

        h(
          'div',
          { className: 'dshb-bar' },
          h(
            'button',
            {
              type: 'button',
              className: 'dshb-btn dshb-btn-primary',
              disabled: snapshot.picking || snapshot.installing,
              onClick: () => actions.pick(),
            },
            snapshot.picking ? t('picking') : t('pickFolder'),
          ),
          snapshot.dir
            ? h('code', { className: 'dshb-path', title: snapshot.dir }, snapshot.dir)
            : h('span', { className: 'dshb-note' }, t('noFolder')),
          snapshot.dir
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dshb-btn',
                  disabled: snapshot.scanning || snapshot.installing,
                  onClick: () => actions.rescan(),
                },
                snapshot.scanning ? t('scanning') : t('rescan'),
              )
            : null,
          rows.length ? h('span', { className: 'dshb-grow' }) : null,
          rows.length ? h('span', { className: 'dshb-note' }, t('selected', { count: String(selected) })) : null,
          rows.length
            ? h(
                'button',
                { type: 'button', className: 'dshb-btn', disabled: snapshot.installing, onClick: () => actions.selectAll(true) },
                t('selectAll'),
              )
            : null,
          rows.length
            ? h(
                'button',
                { type: 'button', className: 'dshb-btn', disabled: snapshot.installing, onClick: () => actions.selectAll(false) },
                t('clear'),
              )
            : null,
        ),

        snapshot.scanError ? h('p', { className: 'dshb-err', role: 'alert' }, `${t('scanFailed')}：${snapshot.scanError}`) : null,

        snapshot.scanning && !rows.length ? h('div', { className: 'dshb-empty' }, t('scanning')) : null,

        snapshot.dir && !snapshot.scanning && !snapshot.scanError && !rows.length
          ? h(
              'div',
              { className: 'dshb-empty' },
              h('div', null, t('empty')),
              h('div', { className: 'dshb-note' }, t('emptyHint')),
            )
          : null,

        rows.length
          ? h(
              'div',
              { className: 'dshb-note' },
              `${t('found', { count: String(rows.length) })} · ${t('installable', { count: String(installable) })}`,
              snapshot.skipped ? ` · ${t('skipped', { count: String(snapshot.skipped) })}` : '',
              snapshot.truncated ? ` · ${t('truncated')}` : '',
            )
          : null,

        list,

        snapshot.result
          ? h(
              'div',
              { className: 'dshb-sum', role: 'status' },
              h(
                'span',
                null,
                t('summary', {
                  ok: String(snapshot.result.ok),
                  restart: String(snapshot.result.restart),
                  failed: String(snapshot.result.failed),
                }),
              ),
              snapshot.result.ok > 0 && props.openPackage
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dshb-btn',
                      onClick: () => props.openPackage(snapshot.result.lastName),
                    },
                    t('viewInstalled'),
                  )
                : null,
            )
          : null,

        snapshot.installing
          ? h(
              'div',
              { className: 'dshb-note', role: 'status' },
              t('installing', { index: String(progress.index + 1), total: String(progress.total) }),
            )
          : null,

        snapshot.logTail.length
          ? h(
              'div',
              null,
              h('div', { className: 'dshb-note' }, t('log')),
              h('pre', { className: 'dshb-log' }, snapshot.logTail.join('\n')),
            )
          : null,

        h(
          'div',
          { className: 'dshb-bar' },
          h(
            'button',
            {
              type: 'button',
              className: 'dshb-btn dshb-btn-primary',
              disabled: snapshot.installing || selected === 0,
              onClick: () => actions.install(),
            },
            t('install', { count: String(selected) }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshb-btn',
              disabled: snapshot.installing || !snapshot.dir,
              onClick: () => actions.rescan(),
            },
            t('reload'),
          ),
        ),
      )
    }

    /** plugins.tab 里的标签页内容。 */
    function TabEntry() {
      return h(Panel, { variant: 'tab' })
    }

    /** shell.overlay 里的浮层：只有打开时才渲染。 */
    function OverlayEntry() {
      const t = view.t
      const actions = view.actions
      const snapshot = useSnapshot()
      React.useEffect(() => {
        if (!snapshot.overlay) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') actions.closeOverlay()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [snapshot.overlay, actions])
      if (!snapshot.overlay) return null
      return h(
        'div',
        {
          className: 'dshb-mask',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('title'),
          onClick: () => actions.closeOverlay(),
        },
        h(
          'div',
          { className: 'dshb-modal', onClick: (event) => event.stopPropagation() },
          h(Panel, { variant: 'modal', onClose: () => actions.closeOverlay() }),
        ),
      )
    }

    /** 插件页「添加」菜单里的一行：不输路径，直接开面板。 */
    function AddMenuEntry(props) {
      const t = view.t
      const actions = view.actions
      return h(
        'button',
        {
          type: 'button',
          className: 'dshb-menuRow',
          onClick: () => {
            if (props && typeof props.onDismiss === 'function') props.onDismiss()
            actions.openOverlay()
          },
        },
        h('span', { className: 'dshb-menuTitle' }, t('menuTitle')),
        h('span', { className: 'dshb-menuDesc' }, t('menuDesc')),
      )
    }

    /** 本浏览器半边要求就绪的客户端服务：槽位、字典、远端命名空间。 */
    const inject = ['slots', 'locale', 'remote', 'remote.pluginManager', 'remote.directoryPicker']

    /**
     * 装上样式、字典、控制器，并把三个槽位登记进去。
     *
     * @param ctx - 浏览器侧插件 context。
     */
    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.setAttribute('data-dsh-batch-install', '')
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'dsh-batch-install: styles')

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-batch-install: dictionaries')

      const t = ctx.locale.bind(NS)
      view.t = t

      const store = createStore({
        dir: null,
        rows: [],
        scanning: false,
        scanError: null,
        skipped: 0,
        truncated: false,
        picking: false,
        installing: false,
        progress: { index: 0, total: 0 },
        result: null,
        logTail: [],
        overlay: false,
        unmanaged: false,
      })
      view.store = store

      /** 读一次已安装组合包：名字 → { installed, source }。 */
      async function bundleIndex() {
        const manager = ctx.remote && ctx.remote.pluginManager
        if (!manager || typeof manager.listBundles !== 'function') return new Map()
        const bundles = await manager.listBundles()
        const index = new Map()
        for (const bundle of bundles || []) {
          if (bundle && typeof bundle.name === 'string') {
            index.set(bundle.name, { installed: bundle.installed === true, source: bundle.source })
          }
        }
        return index
      }

      /** 打开系统 / 浏览器的目录选择器；取消返回 null。 */
      async function pickDirectory() {
        const picker = ctx.remote && ctx.remote.directoryPicker
        if (!picker || typeof picker.pick !== 'function') throw new Error(t('noPicker'))
        const answer = await picker.pick()
        if (answer && typeof answer === 'object' && typeof answer.ok === 'boolean') {
          if (!answer.ok) throw new Error(answer.error?.message || t('pickFailed'))
          return answer.value ?? null
        }
        return answer ?? null
      }

      /** 把一段安装结果翻成人话。 */
      function failureText(result) {
        const error = result && result.error
        const code = error && error.code
        const table = {
          'already-installed': t('alreadyInstalled'),
          'not-bundle': t('notBundle'),
          'invalid-spec': t('invalidSpec'),
          'incompatible-version': t('incompatible'),
          'ambiguous-install': t('invalidSpec'),
        }
        const base = table[code] || t('unknownFail')
        if (code === 'incompatible-version' && error && Array.isArray(error.incompatible)) {
          const names = error.incompatible
            .map((item) => `${item.name}@${item.version} → ${Object.values(item.requirements || {}).join(', ')}`)
            .join('；')
          return names ? `${base}（${names}）` : base
        }
        const diagnostic = error && typeof error.diagnostic === 'string' && error.diagnostic ? error.diagnostic : ''
        return diagnostic ? `${base}：${diagnostic}` : base
      }

      const actions = {
        openOverlay() {
          store.set({ overlay: true })
        },
        closeOverlay() {
          store.set({ overlay: false })
        },
        toggle(key, on) {
          store.set((state) => ({ rows: state.rows.map((row) => (row.key === key ? { ...row, selected: on } : row)) }))
        },
        selectAll(on) {
          store.set((state) => ({
            rows: state.rows.map((row) =>
              row.installable && !row.installed && row.status !== 'done' ? { ...row, selected: on } : row,
            ),
          }))
        },
        async pick() {
          if (store.get().picking || store.get().installing) return
          store.set({ picking: true })
          try {
            const dir = await pickDirectory()
            store.set({ picking: false })
            if (dir) await actions.scan(dir)
          } catch (error) {
            store.set({ picking: false, scanError: messageOf(error) })
          }
        },
        async rescan() {
          const dir = store.get().dir
          if (dir) await actions.scan(dir)
        },
        async scan(dir) {
          store.set({ dir, scanning: true, scanError: null, result: null, rows: [], logTail: [] })
          try {
            let index = new Map()
            try {
              index = await bundleIndex()
            } catch {
              index = new Map()
            }
            const response = await fetch(SCAN_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ dir }),
            })
            const data = await response.json().catch(() => null)
            if (!data || data.ok !== true) throw new Error((data && data.error) || `HTTP ${response.status}`)
            const rows = (data.plugins || []).map((plugin) => {
              const found = index.get(plugin.name)
              const specDir = found ? dirOfSpec(found.source) : null
              const installedHere = Boolean(found && found.installed && specDir === plugin.path.replace(/\/+$/, ''))
              return {
                key: plugin.path,
                path: plugin.path,
                folder: plugin.folder,
                name: plugin.name,
                version: plugin.version,
                description: plugin.description,
                kind: plugin.kind,
                hasClient: plugin.hasClient !== false,
                installable: plugin.installable !== false,
                installed: Boolean(found && found.installed),
                installedHere,
                selected: false,
                status: 'idle',
                message: '',
              }
            })
            for (const row of rows) row.selected = row.installable && !row.installed
            store.set({
              scanning: false,
              rows,
              skipped: typeof data.skippedTotal === 'number' ? data.skippedTotal : (data.skipped || []).length,
              truncated: data.truncated === true,
              unmanaged: false,
            })
          } catch (error) {
            store.set({ scanning: false, scanError: messageOf(error) })
          }
        },
        async install() {
          const state = store.get()
          if (state.installing) return
          const targets = state.rows.filter((row) => row.selected && row.installable && !row.installed)
          if (!targets.length) return
          const manager = ctx.remote && ctx.remote.pluginManager
          if (!manager || typeof manager.installBundle !== 'function') {
            store.set({ unmanaged: true })
            return
          }
          const patchRow = (key, patch) => {
            store.set((current) => ({ rows: current.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)) }))
          }
          store.set({
            installing: true,
            result: null,
            logTail: [],
            progress: { index: 0, total: targets.length },
          })
          let ok = 0
          let restart = 0
          let failed = 0
          let lastName = null
          for (let position = 0; position < targets.length; position += 1) {
            const target = targets[position]
            patchRow(target.key, { status: 'running', message: '' })
            store.set({ progress: { index: position, total: targets.length } })
            try {
              const result = await manager.installBundle(target.path)
              const application = result && result.application
              if (application === 'failed') {
                failed += 1
                patchRow(target.key, { status: 'failed', message: failureText(result) })
              } else if (application === 'cancelled') {
                failed += 1
                patchRow(target.key, { status: 'failed', message: t('statusFailed') })
              } else if (application === 'restart-required') {
                restart += 1
                patchRow(target.key, { status: 'restart', message: t('needRestart'), installed: true })
              } else {
                ok += 1
                lastName = (result && result.bundle) || target.name
                patchRow(target.key, {
                  status: 'done',
                  installed: true,
                  installedHere: true,
                  message: '',
                  version: (result && result.version) || target.version,
                })
              }
            } catch (error) {
              failed += 1
              patchRow(target.key, { status: 'failed', message: messageOf(error) })
            }
            store.set({ progress: { index: position + 1, total: targets.length } })
          }
          store.set({ installing: false, result: { ok, restart, failed, total: targets.length, lastName } })
          // 安装会改 profile 清单：重扫一遍，把「已安装 / 其他来源」标对
          const dir = store.get().dir
          if (dir) {
            const rows = store.get().rows
            try {
              const index = await bundleIndex()
              store.set({
                rows: rows.map((row) => {
                  const found = index.get(row.name)
                  if (!found || !found.installed) return row
                  const specDir = dirOfSpec(found.source)
                  return {
                    ...row,
                    installed: true,
                    installedHere: specDir === row.path.replace(/\/+$/, ''),
                    selected: false,
                  }
                }),
              })
            } catch {
              // 读不回来就保留当前状态，不影响已经装好的结果
            }
          }
        },
      }
      view.actions = actions

      // 安装日志：只留最后几行，失败时给人一个能看的线索
      ctx.effect(() => {
        const on = ctx.remote && typeof ctx.remote.$on === 'function' ? ctx.remote.$on.bind(ctx.remote) : null
        if (!on) return () => {}
        const off = on('plugin-manager/install-log', (chunk) => {
          if (typeof chunk !== 'string' || !chunk) return
          const lines = chunk.split('\n').filter((line) => line.trim() !== '')
          if (!lines.length) return
          store.set((state) => ({ logTail: [...state.logTail, ...lines].slice(-8) }))
        })
        return () => {
          if (typeof off === 'function') off()
        }
      }, 'dsh-batch-install: install log')

      // 1) 插件页里的「批量安装」标签
      ctx.slots.inject('plugins.tab', () =>
        ctx.slots.register(
          {
            name: 'plugins.tab',
            id: SLOT_ID,
            order: 20,
            label: () => view.t('tab'),
            locale: NS,
          },
          TabEntry,
        ),
      )

      // 2) 「添加」菜单里的入口（点开浮层，不用手输路径）
      ctx.slots.inject('plugins.add.actions', () =>
        ctx.slots.register(
          {
            name: 'plugins.add.actions',
            id: SLOT_ID,
            order: 20,
            locale: NS,
          },
          AddMenuEntry,
        ),
      )

      // 3) 浮层本体
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: SLOT_ID,
            order: 60,
          },
          OverlayEntry,
        ),
      )
    }

    return { inject, apply }
  },
})
