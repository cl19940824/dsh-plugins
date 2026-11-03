/**
 * dsh-file-explorer —— 浏览器半边。
 *
 * 左侧栏底部多一个文件夹图标（sidebar.panellist），点开进入一个 Xcode 风格的文件面板
 * （main 槽位，key = file-explorer）：左边是工作区文件树，右边是带行号和语法高亮的
 * 编辑器。文件夹点一下只展开 / 收起，不能改名不能删；文件可以看、可以改、⌘S 保存。
 *
 * 高亮是插件自带的轻量分词器（不依赖 shiki）—— 颜色全走主题变量（--shiki-token-*），
 * 所以和聊天里的代码块、以及 Xcode 主题是同一套配色。
 *
 * 编辑用「textarea 透明文字 + 背后高亮层」的经典做法，字体度量一致就不会错位。
 */

window.__ModuleLoader__.load({
  id: 'dsh-file-explorer',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React

    /** 字典命名空间。 */
    const NS = 'fileExplorer'
    /** 本插件在 sidebar.panellist / main 里的 id。 */
    const SLOT_ID = 'file-explorer'
    /** 宿主半边接口。 */
    const API = '/api/file-explorer'

    const zh = {
      title: '文件',
      explorer: '资源管理器',
      filter: '筛选文件…',
      refresh: '刷新',
      save: '保存',
      saved: '已保存',
      unsaved: '未保存',
      saveFailed: '保存失败',
      reload: '重新加载',
      overwrite: '强制覆盖',
      overwriteHint: '磁盘上的文件已经被改过了，保存会覆盖它。',
      empty: '这个工作区是空的',
      noWorkspace: '没有可用的工作区',
      pickFile: '从左侧选择一个文件',
      loading: '载入中…',
      binary: '这是二进制文件，没法按文本打开',
      tooLarge: '文件太大（{size}），不在面板里打开',
      imageAlt: '图片预览',
      lines: '{count} 行',
      readOnly: '只读',
      line: '行 {n}',
      filterEmpty: '没有匹配的文件',
      searchFailed: '搜索失败',
      searching: '搜索中…',
      stale: '文件已在磁盘上被修改',
      openFailed: '打不开这个文件',
      listFailed: '读不出这个目录',
      workspace: '工作区',
      switchWorkspace: '切换工作区',
      splitHint: '拖动调整宽度',
    }

    const en = {
      title: 'Files',
      explorer: 'Explorer',
      filter: 'Filter files…',
      refresh: 'Refresh',
      save: 'Save',
      saved: 'Saved',
      unsaved: 'Unsaved',
      saveFailed: 'Save failed',
      reload: 'Reload',
      overwrite: 'Overwrite',
      overwriteHint: 'The file changed on disk; saving overwrites it.',
      empty: 'This workspace is empty',
      noWorkspace: 'No workspace available',
      pickFile: 'Select a file on the left',
      loading: 'Loading…',
      binary: 'Binary file — cannot open as text',
      tooLarge: 'File too large ({size}) to open here',
      imageAlt: 'Image preview',
      lines: '{count} lines',
      readOnly: 'read only',
      line: 'Line {n}',
      filterEmpty: 'No matching files',
      searchFailed: 'Search failed',
      searching: 'Searching…',
      stale: 'The file changed on disk',
      openFailed: 'Could not open this file',
      listFailed: 'Could not list this folder',
      workspace: 'Workspace',
      switchWorkspace: 'Switch workspace',
      splitHint: 'Drag to resize',
    }

    /* ------------------------------------------------------------------ */
    /* 语言表：关键字 / 内置类型 / 注释 / 引号                              */
    /* ------------------------------------------------------------------ */

    const JS_KW = 'as async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield true false null undefined'
    const TS_KW = `${JS_KW} interface type enum implements private public protected readonly declare namespace abstract keyof infer satisfies`
    const JS_TY = 'Array Boolean Date Error Function JSON Map Math Number Object Promise RegExp Set String Symbol WeakMap WeakSet BigInt Intl Reflect'

    const LANG_DEF = {
      js: [JS_KW, JS_TY, '//', "'\"`", false],
      jsx: [JS_KW, JS_TY, '//', "'\"`", false],
      ts: [TS_KW, JS_TY, '//', "'\"`", false],
      tsx: [TS_KW, JS_TY, '//', "'\"`", false],
      json: ['true false null', '', '//', '"', false],
      py: ['and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None self', 'int str float bool list dict set tuple bytes object Exception range len print', '#', "'\"", false],
      swift: ['func var let class struct enum protocol extension import return if else for while repeat switch case default break continue guard defer throw throws try catch do in where self super nil true false init deinit static public private fileprivate internal open override mutating final lazy weak unowned as is some any associatedtype typealias required convenience dynamic indirect', 'Int Double Float String Bool Character Array Dictionary Set Optional Result Any AnyObject Void', '//', '"', false],
      objc: ['@interface @implementation @end @property @synthesize @dynamic @protocol @class @selector @import @autoreleasepool @try @catch @finally @throw @optional @required @public @private @protected @package return if else for while do switch case default break continue self super nil Nil YES NO id instancetype void static const extern typedef struct enum union sizeof goto inline', 'NSInteger NSUInteger CGFloat NSString NSArray NSMutableArray NSDictionary NSMutableDictionary NSSet NSCountedSet NSNumber BOOL CGRect CGPoint CGSize CGRectMake UIEdgeInsets UIView UIViewController UIImage UIColor UITableView UITableViewCell UILabel UIButton CGRectZero', '//', '"', true],
      c: ['auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while', 'size_t FILE int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t bool', '//', '"', false],
      cpp: ['auto break case catch class const constexpr continue default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while override final', 'std string vector map set unique_ptr shared_ptr size_t int8_t uint32_t bool', '//', '"', false],
      java: ['abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed permits', 'String Integer Long Double Float Boolean Object List Map Set ArrayList HashMap Optional', '//', '"', false],
      kotlin: ['as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while by catch constructor delegate dynamic field file finally get import init param property receiver set setparam where actual abstract annotation companion const crossinline data enum expect external final infix inline inner internal lateinit noinline open operator out override private protected public reified sealed suspend tailrec vararg', 'Int Long Double Float String Boolean Char List Map Set MutableList Array Any Unit Nothing', '//', '"', false],
      dart: ['abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for Function get hide if implements import in interface is late library mixin new null on operator part required rethrow return set show static super switch sync this throw true try typedef var void while with yield', 'int double num String bool List Map Set Future Stream Object dynamic Widget BuildContext StatelessWidget StatefulWidget', '//', '"', false],
      go: ['break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota make new len cap append delete copy panic recover', 'string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 byte rune error bool any', '//', '"`', false],
      rust: ['as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while yield', 'i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 f32 f64 bool char str String Vec Option Result Box Rc Arc HashMap', '//', '"', false],
      sh: ['case do done elif else esac exit export fi for function if in local readonly return select set shift then time trap unset until while echo cd pwd source alias', 'true false', '#', "'\"", false],
      yaml: ['true false null yes no on off', '', '#', "'\"", false],
      css: ['important media import supports keyframes font-face from to and not only', '', '//', "'\"", false],
      html: ['html head body div span script style link meta title section article header footer main nav aside button input form label table tr td th ul ol li a img svg path template', '', '//', "'\"", false],
      sql: ['select from where insert into values update set delete create table drop alter add column index join left right inner outer on group by order having limit offset as distinct union all and or not null is in like between case when then else end primary key foreign references default', 'int integer varchar text boolean date timestamp decimal float double bigint smallint char', '--', "'\"", false],
      md: ['', '', '', '', false],
      toml: ['true false', '', '#', "'\"", false],
      rb: ['alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield require attr_accessor', 'String Integer Float Array Hash Symbol Proc Range Time', '#', "'\"", false],
      php: ['abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null', 'int float string bool array object iterable void mixed never', '//', '"', false],
      xml: ['', '', '', '"', false],
      proto: ['syntax package import message enum service rpc returns repeated optional required string int32 int64 uint32 uint64 bool bytes double float map oneof reserved', 'string int32 int64 bool bytes double float', '//', '"', false],
      cs: ['abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while var record init', 'String Int32 Int64 Double Boolean Object List Dictionary Task Action Func', '//', '"', false],
      lua: ['and break do else elseif end false for function goto if in local nil not or repeat return then true until while', 'string number boolean table', '--', "'\"", false],
      scala: ['abstract case catch class def do else extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait try true type val var while with yield', 'String Int Long Double Boolean Any List Seq Map Set Option Either Future', '//', '"', false],
      r: ['break else for function if in next repeat return while TRUE FALSE NULL Inf NaN NA', 'character numeric integer logical list data.frame matrix vector factor', '#', "'\"", false],
      groovy: ['abstract as assert break case catch class const continue def default do else enum extends final finally for goto if implements import in instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws trait transient try void volatile while true false null it', 'String Integer Long Double Float Boolean List Map Set Closure', '//', '"', false],
    }

    const EXT_LANG = {
      js: 'js', mjs: 'js', cjs: 'js', jsx: 'jsx',
      ts: 'ts', mts: 'ts', cts: 'ts', tsx: 'tsx',
      json: 'json', jsonc: 'json', webmanifest: 'json',
      py: 'py', pyw: 'py',
      swift: 'swift',
      m: 'objc', mm: 'objc', h: 'objc', hpp: 'cpp', hh: 'cpp',
      c: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp',
      java: 'java', kt: 'kotlin', kts: 'kotlin',
      dart: 'dart', go: 'go', rs: 'rust',
      sh: 'sh', bash: 'sh', zsh: 'sh', fish: 'sh',
      yml: 'yaml', yaml: 'yaml',
      css: 'css', scss: 'css', less: 'css',
      html: 'html', htm: 'html', vue: 'html', svelte: 'html', xml: 'xml', svg: 'xml', plist: 'xml',
      md: 'md', markdown: 'md', mdx: 'md',
      sql: 'sql', toml: 'toml', ini: 'toml', conf: 'toml',
      rb: 'rb', rake: 'rb', gemspec: 'rb', podspec: 'rb', ru: 'rb',
      php: 'php', proto: 'proto',
      cs: 'cs', lua: 'lua', scala: 'scala', sc: 'scala', r: 'r',
      groovy: 'groovy', gradle: 'groovy', gvy: 'groovy',
      mk: 'sh', make: 'sh', cmake: 'sh', dockerfile: 'sh',
      xcconfig: 'toml', entitlements: 'xml', storyboard: 'xml', xib: 'xml',
      lock: 'yaml', mdx: 'md',
    }

    /** 没有扩展名、或扩展名不可靠的文件，按文件名直接判定语言。 */
    const NAME_LANG = {
      podfile: 'rb', 'podfile.lock': 'yaml', gemfile: 'rb', 'gemfile.lock': 'rb',
      rakefile: 'rb', fastfile: 'rb', appfile: 'rb', matchfile: 'rb', dangerfile: 'rb',
      brewfile: 'rb', vagrantfile: 'rb', guardfile: 'rb', capfile: 'rb', thorfile: 'rb',
      podspec: 'rb',
      dockerfile: 'sh', makefile: 'sh', 'cmakelists.txt': 'sh', 'gnumakefile': 'sh',
      '.gitignore': 'sh', '.gitattributes': 'sh', '.npmignore': 'sh', '.dockerignore': 'sh',
      '.env': 'toml', '.editorconfig': 'toml', '.babelrc': 'json', '.eslintrc': 'json',
      'package-lock.json': 'json', 'tsconfig.json': 'json',
      'cartfile': 'rb', 'cartfile.private': 'rb',
    }

    /** 扩展名缺失或陌生时，用内容猜语言。返回 '' 表示没把握。 */
    function sniffLang(text) {
      const head = text.slice(0, 4000)
      const shebang = /^\s*#!\s*\S*?(python[\d.]*|node|bun|bash|zsh|sh|ruby|perl|php)\b/.exec(head)
      if (shebang) {
        const name = shebang[1]
        if (name.startsWith('python')) return 'py'
        if (name === 'node' || name === 'bun') return 'js'
        if (name === 'ruby') return 'rb'
        if (name === 'php') return 'php'
        if (name === 'perl') return 'php'
        return 'sh'
      }
      if (/^\s*<\?xml\b/i.test(head)) return 'xml'
      if (/^\s*<!doctype html/i.test(head) || /<html[\s>]/i.test(head)) return 'html'
      if (/Pod::Spec|\.podspec|platform\s+:(ios|osx|tvos|watchos)|use_frameworks!|source\s+'https?:\/\/github\.com\/CocoaPods/i.test(head)) return 'rb'
      if (/@interface\s+\w+|#import\s*[<"]|@implementation\s+\w+|\bNS[A-Z]\w*\s*\*/.test(head)) return 'objc'
      if (/\bimport\s+(UIKit|Foundation|SwiftUI|AppKit)\b|\bfunc\s+\w+\s*\(|\blet\s+\w+\s*:/.test(head)) return 'swift'
      if (/^\s*package\s+\w+\s*$/m.test(head) && /\bfunc\s+\w+\s*\(/.test(head)) return 'go'
      if (/\bfn\s+main\s*\(|\buse\s+std::/.test(head)) return 'rust'
      if (/^\s*def\s+\w+\s*\(.*\)\s*:\s*$/m.test(head) || /^\s*(from\s+\S+\s+)?import\s+[\w.]+\s*$/m.test(head)) return 'py'
      if (/^\s*(---\s*$)[\s\S]*^[\w.-]+\s*:/m.test(head)) return 'yaml'
      if (/^\s*[{[]\s*"[^"]+"\s*:/.test(head)) return 'json'
      if (/\b(SELECT|INSERT\s+INTO|CREATE\s+TABLE|UPDATE\s+\w+\s+SET)\b/i.test(head)) return 'sql'
      if (/<([a-z][\w-]*)(\s+[\w:-]+=("[^"]*"|'[^']*'))*\s*\/?>/i.test(head)) return 'html'
      if (/^\s*#{1,6}\s+\S/m.test(head) && /\n\s*[-*]\s+\S/.test(head)) return 'md'
      return ''
    }

    const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif'])

    const LANG_LABEL = {
      js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', json: 'JSON', py: 'Python',
      swift: 'Swift', objc: 'Objective-C', c: 'C', cpp: 'C++', java: 'Java', kotlin: 'Kotlin',
      dart: 'Dart', go: 'Go', rust: 'Rust', sh: 'Shell', yaml: 'YAML', css: 'CSS', html: 'HTML',
      xml: 'XML', md: 'Markdown', sql: 'SQL', toml: 'TOML', rb: 'Ruby', php: 'PHP', proto: 'Protobuf',
    }

    /** 每种语言把关键字拆成 Set 一次性建好，分词时只做 O(1) 命中。 */
    const LANG = {}
    for (const [id, def] of Object.entries(LANG_DEF)) {
      LANG[id] = {
        kw: new Set(def[0].split(/\s+/).filter(Boolean)),
        ty: new Set(def[1].split(/\s+/).filter(Boolean)),
        line: def[2] || null,
        quotes: def[3] || '',
        at: def[4] === true,
      }
    }

    /* ------------------------------------------------------------------ */
    /* 小工具                                                              */
    /* ------------------------------------------------------------------ */

    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
    const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ESC[c])

    const extOf = (path) => {
      const base = path.slice(path.lastIndexOf('/') + 1)
      const dot = base.lastIndexOf('.')
      return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
    }
    const baseName = (path) => path.slice(path.lastIndexOf('/') + 1)
    const dirName = (path) => path.slice(0, path.lastIndexOf('/'))
    const joinPath = (dir, name) => (dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`)

    const langOf = (path, text) => {
      const name = baseName(path).toLowerCase()
      return NAME_LANG[name] || EXT_LANG[extOf(path)] || (text ? sniffLang(text) : '') || 'txt'
    }

    const formatBytes = (bytes) => {
      if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return ''
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    /* ------------------------------------------------------------------ */
    /* 分词器                                                              */
    /* ------------------------------------------------------------------ */

    const IDENT_START = /[A-Za-z_$@]/
    const IDENT_PART = /[\w$]/
    const DIGIT = /[0-9]/

    /**
     * 把一段源码切成带 class 的 HTML。
     *
     * 只做「词法」级别：注释、字符串、数字、标识符、其余原样。标识符再按
     * 关键字 / 内置类型 / 调用 / 大写开头（类型）/ 普通变量 分类上色。
     *
     * @param text - 源码。
     * @param lang - 语言 id。
     * @returns 转义过、带 span 的 HTML 字符串。
     */
    /** 行内 markdown：行内代码 / 粗体 / 斜体 / 链接。 */
    function inlineMd(line) {
      const out = []
      let acc = ''
      let i = 0
      const flush = () => {
        if (acc) {
          out.push(escapeHtml(acc))
          acc = ''
        }
      }
      while (i < line.length) {
        const rest = line.slice(i)
        let m
        if (rest[0] === '`' && (m = /^`+([^`]+)`+/.exec(rest))) {
          flush()
          out.push(`<span class="fx-md-code">${escapeHtml(m[1])}</span>`)
          i += m[0].length
          continue
        }
        if ((m = /^\*\*([^*]+)\*\*/.exec(rest)) || (m = /^__([^_]+)__/.exec(rest))) {
          flush()
          out.push(`<span class="fx-md-strong">${escapeHtml(m[1])}</span>`)
          i += m[0].length
          continue
        }
        if ((m = /^\*([^*\s][^*]*)\*/.exec(rest)) || (m = /^_([^_\s][^_]*)_/.exec(rest))) {
          flush()
          out.push(`<span class="fx-md-em">${escapeHtml(m[1])}</span>`)
          i += m[0].length
          continue
        }
        if ((m = /^!?\[([^\]]*)\]\(([^)]*)\)/.exec(rest))) {
          flush()
          out.push(`<span class="fx-md-link">${escapeHtml(m[1] || m[2])}</span>`)
          i += m[0].length
          continue
        }
        if ((m = /^<(https?:\/\/[^>]+)>/.exec(rest))) {
          flush()
          out.push(`<span class="fx-md-link">${escapeHtml(m[1])}</span>`)
          i += m[0].length
          continue
        }
        acc += line[i]
        i += 1
      }
      flush()
      return out.join('')
    }

    /** markdown：按行处理围栏代码块、标题、引用、列表、分割线，其余走行内规则。 */
    function highlightMarkdown(text) {
      const lines = text.split('\n')
      const out = []
      let fence = null
      for (const line of lines) {
        const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
        if (fence) {
          if (open && line.trim().startsWith(fence.mark)) {
            fence = null
            out.push(`<span class="fx-md-code">${escapeHtml(line)}</span>`)
          } else if (fence.lang && LANG[fence.lang]) {
            out.push(highlight(line, fence.lang))
          } else {
            out.push(`<span class="fx-md-code">${escapeHtml(line)}</span>`)
          }
          continue
        }
        if (open) {
          const info = line.trim().slice(open[1].length).trim().split(/\s+/)[0]
          const alias = info ? EXT_LANG[info.toLowerCase()] || (LANG[info.toLowerCase()] ? info.toLowerCase() : '') : ''
          fence = { mark: open[1], lang: alias }
          out.push(`<span class="fx-md-code">${escapeHtml(line)}</span>`)
          continue
        }
        if (/^\s{0,3}#{1,6}\s/.test(line)) {
          out.push(`<span class="fx-md-h">${inlineMd(line)}</span>`)
        } else if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
          out.push(`<span class="fx-md-hr">${escapeHtml(line)}</span>`)
        } else if (/^\s{0,3}>/.test(line)) {
          out.push(`<span class="fx-md-quote">${inlineMd(line)}</span>`)
        } else if (/^\s*([-*+]|\d+[.)])\s/.test(line)) {
          const marker = /^\s*([-*+]|\d+[.)])\s/.exec(line)
          const head = line.slice(0, line.search(/\S/) + marker[1].length)
          out.push(`<span class="fx-md-list">${escapeHtml(head)}</span>${inlineMd(line.slice(head.length))}`)
        } else {
          out.push(inlineMd(line))
        }
      }
      return out.join('\n')
    }

    function highlight(text, lang) {
      const cfg = LANG[lang]
      if (lang === 'md') return highlightMarkdown(text)
      if (!cfg || lang === 'txt') return escapeHtml(text)
      const out = []
      let i = 0
      let plain = ''

      const flush = () => {
        if (plain) {
          out.push(escapeHtml(plain))
          plain = ''
        }
      }
      const emit = (cls, chunk) => {
        flush()
        out.push(`<span class="fx-${cls}">${escapeHtml(chunk)}</span>`)
      }

      while (i < text.length) {
        const ch = text[i]
        const next = text[i + 1]

        // 行注释
        if (cfg.line && ch === cfg.line[0] && text.startsWith(cfg.line, i)) {
          const end = text.indexOf('\n', i)
          const stop = end < 0 ? text.length : end
          emit('cm', text.slice(i, stop))
          i = stop
          continue
        }

        // 块注释
        if (ch === '/' && next === '*') {
          const end = text.indexOf('*/', i + 2)
          const stop = end < 0 ? text.length : end + 2
          emit('cm', text.slice(i, stop))
          i = stop
          continue
        }

        // 字符串（objc 的 @"..."）
        const at = cfg.at && ch === '@' && cfg.quotes.includes(next)
        if (cfg.quotes.includes(ch) || at) {
          const quote = at ? next : ch
          const start = at ? i + 1 : i
          let j = start + 1
          while (j < text.length) {
            const c = text[j]
            if (c === '\\') {
              j += 2
              continue
            }
            if (c === quote) {
              j += 1
              break
            }
            if (c === '\n' && quote !== '`') break
            j += 1
          }
          emit('str', text.slice(i, j))
          i = j
          continue
        }

        // 数字
        if (DIGIT.test(ch) && !IDENT_PART.test(text[i - 1] || '')) {
          let j = i + 1
          while (j < text.length && /[0-9a-fA-FxXoObB._eE+-]/.test(text[j])) {
            if ((text[j] === '+' || text[j] === '-') && !/[eE]/.test(text[j - 1])) break
            j += 1
          }
          emit('num', text.slice(i, j))
          i = j
          continue
        }

        // 标识符
        if (IDENT_START.test(ch)) {
          let j = i + 1
          while (j < text.length && IDENT_PART.test(text[j])) j += 1
          const word = text.slice(i, j)
          let cls = null
          if (cfg.kw.has(word)) cls = 'kw'
          else if (cfg.ty.has(word)) cls = 'ty'
          else if (/^[ \t]*\(/.test(text.slice(j, j + 30))) cls = 'fn'
          // OC 自己的两套写法：`foo:bar:` 选择器跟 `[super viewDidLoad]` 无参消息。
          else if (cfg.at && /^[ \t]*[:\]]/.test(text.slice(j, j + 8))) cls = 'fn'
          else if (/^[A-Z]/.test(word)) cls = 'ty'
          else cls = 'var'
          if (cls) emit(cls, word)
          else plain += word
          i = j
          continue
        }

        plain += ch
        i += 1
      }
      flush()
      return out.join('')
    }

    /* ------------------------------------------------------------------ */
    /* 样式                                                                */
    /* ------------------------------------------------------------------ */

    const CSS = [
      '.fx-root{display:flex;flex-direction:column;height:100%;min-height:420px;box-sizing:border-box;color:var(--dsw-alias-label-primary,#e6e6ea);background:var(--dsw-alias-bg-base,#1f1f24);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif)}',
      '.fx-head{display:flex;align-items:center;gap:10px;flex:none;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.fx-title{display:flex;align-items:baseline;gap:8px;font-size:14px;font-weight:600}',
      '.fx-rootPath{font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary,#8b8b95);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);max-width:52vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.fx-headActions{margin-left:auto;display:flex;align-items:center;gap:8px}',
      '.fx-btn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12));background:transparent;color:inherit;font:inherit;font-size:11.5px;cursor:pointer}',
      '.fx-btn:hover{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))}',
      '.fx-btn[disabled]{opacity:.45;cursor:default}',
      '.fx-btn.primary{background:var(--dsw-alias-brand-primary,#0a84ff);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}',
      '.fx-body{display:flex;flex:1;min-height:0}',
      '.fx-treePane{display:flex;flex-direction:column;min-width:160px;max-width:56%;border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));background:var(--dsw-alias-bg-sidebar,#1a1a1f);position:relative}',
      '.fx-treeHead{display:flex;align-items:center;gap:6px;padding:8px 10px 6px;font-size:11px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary,#8b8b95)}',
      '.fx-treeHead .fx-count{margin-left:auto;font-variant-numeric:tabular-nums}',
      '.fx-filterWrap{padding:0 10px 6px}',
      '.fx-filter{width:100%;box-sizing:border-box;height:24px;padding:0 8px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:inherit;font:inherit;font-size:11.5px;outline:none}',
      '.fx-filter:focus{border-color:var(--dsw-alias-brand-primary,#0a84ff)}',
      '.fx-tree{flex:1;min-height:0;overflow:auto;padding:2px 0 12px}',
      '.fx-row{display:flex;align-items:center;gap:5px;height:22px;padding-right:8px;cursor:pointer;font-size:12px;line-height:22px;white-space:nowrap;user-select:none}',
      '.fx-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05))}',
      '.fx-row.sel{background:var(--dsw-alias-bg-selection,rgba(10,132,255,.22))}',
      '.fx-row .fx-name{overflow:hidden;text-overflow:ellipsis}',
      '.fx-rowPath{margin-left:auto;padding-left:10px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#5a5a63);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl}',
      '.fx-row.dir .fx-name{color:var(--dsw-alias-label-primary,#e6e6ea)}',
      '.fx-chev{display:inline-flex;align-items:center;justify-content:center;width:10px;flex:none;opacity:.75;transform:rotate(0deg);transition:transform .12s ease}',
      '.fx-chev.open{transform:rotate(90deg)}',
      '.fx-ico{display:inline-flex;flex:none;width:13px;align-items:center;justify-content:center}',
      '.fx-resizer{flex:none;width:5px;cursor:col-resize;background:transparent}',
      '.fx-resizer:hover{background:var(--dsw-alias-brand-primary,#0a84ff);opacity:.4}',
      '.fx-main{display:flex;flex-direction:column;flex:1;min-width:0;background:var(--dsw-alias-bg-base,#1f1f24)}',
      '.fx-fileHead{display:flex;align-items:center;gap:8px;flex:none;height:36px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));font-size:12.5px}',
      '.fx-fileName{font-weight:600}',
      '.fx-filePath{color:var(--dsw-alias-label-secondary,#8b8b95);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.fx-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-warn-primary,#e8a800);flex:none}',
      '.fx-fileActions{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}',
      '.fx-editorWrap{flex:1;min-height:0;display:flex;position:relative;overflow:hidden}',
      '.fx-gutter{flex:none;width:52px;overflow:hidden;padding:10px 0;box-sizing:border-box;border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.05));background:var(--dsw-alias-bg-base,#1f1f24)}',
      '.fx-gutterInner{white-space:pre;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12.5px;line-height:20px;text-align:right;color:var(--dsw-alias-label-tertiary,#5a5a63);padding-right:10px;will-change:transform}',
      '.fx-code{position:relative;flex:1;min-width:0;overflow:hidden}',
      '.fx-hl,.fx-input{margin:0;padding:10px 16px 10px 12px;box-sizing:border-box;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12.5px;line-height:20px;letter-spacing:0;tab-size:2;white-space:pre;border:0;outline:none}',
      '.fx-hl{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:var(--dsw-alias-label-primary,#dfe0e2);word-wrap:normal}',
      '.fx-input{position:absolute;inset:0;width:100%;height:100%;overflow:auto;resize:none;background:transparent;color:transparent;caret-color:var(--dsw-alias-label-primary,#e6e6ea);-webkit-text-fill-color:transparent}',
      '.fx-input::selection{background:rgba(10,132,255,.28);-webkit-text-fill-color:transparent}',
      '.fx-status{display:flex;align-items:center;gap:14px;flex:none;height:26px;padding:0 14px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));font-size:11px;color:var(--dsw-alias-label-secondary,#8b8b95);font-variant-numeric:tabular-nums}',
      '.fx-status .fx-spacer{margin-left:auto}',
      '.fx-notice{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--dsw-alias-label-secondary,#8b8b95);font-size:12px;padding:24px;text-align:center}',
      '.fx-imageWrap{flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;padding:18px;background-image:linear-gradient(45deg,rgba(255,255,255,.03) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.03) 75%),linear-gradient(45deg,rgba(255,255,255,.03) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.03) 75%);background-size:16px 16px;background-position:0 0,8px 8px}',
      '.fx-imageWrap img{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 8px 30px rgba(0,0,0,.35);border-radius:4px}',
      '.fx-banner{display:flex;align-items:center;gap:10px;padding:7px 14px;font-size:11.5px;background:var(--dsw-alias-state-warn-bg,rgba(232,168,0,.12));color:var(--dsw-alias-state-warn-primary,#e8a800);border-bottom:1px solid rgba(232,168,0,.2)}',
      '.fx-banner.err{background:rgba(252,106,93,.12);color:var(--dsw-alias-state-error-primary,#fc6a5d)}',
      '.fx-banner .fx-btn{margin-left:auto}',
      '.fx-kw{color:var(--shiki-token-keyword,#fc5fa3)}',
      '.fx-str{color:var(--shiki-token-string,#fc6a5d)}',
      '.fx-num{color:var(--shiki-token-constant,#d0bf69)}',
      '.fx-md-h{color:var(--dsw-alias-markdown-heading,#fc5fa3);font-weight:600}',
      '.fx-md-code{color:var(--dsw-alias-markdown-code,#6fc3de)}',
      '.fx-md-strong{color:var(--dsw-alias-markdown-strong,#f2f3f7);font-weight:600}',
      '.fx-md-em{color:var(--dsw-alias-markdown-emph,#dfdfe0);font-style:italic}',
      '.fx-md-link{color:var(--dsw-alias-markdown-link,#6699ff)}',
      '.fx-md-quote{color:var(--dsw-alias-markdown-block-quote,#8b8b95)}',
      '.fx-md-list{color:var(--dsw-alias-brand-primary,#0a84ff)}',
      '.fx-md-hr{color:var(--dsw-alias-border-l2,rgba(255,255,255,.28))}',
      '.fx-cm{color:var(--shiki-token-comment,#7f8c98)}',
      '.fx-ty{color:var(--shiki-token-parameter,#5dd8ff)}',
      '.fx-fn{color:var(--shiki-token-function,#41a1c0)}',
      '.fx-var{color:color-mix(in oklab,var(--shiki-token-parameter,#5dd8ff) 45%,var(--shiki-token-function,#41a1c0) 55%)}',
    ].join('')

    /* ------------------------------------------------------------------ */
    /* store                                                               */
    /* ------------------------------------------------------------------ */

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

    const view = { store: null, actions: null, t: (key) => key }

    function useSnapshot() {
      const store = view.store
      const [snapshot, setSnapshot] = useState(() => store.get())
      useEffect(() => {
        setSnapshot(store.get())
        return store.subscribe(() => setSnapshot(store.get()))
      }, [store])
      return snapshot
    }

    /** t('lines', {count: 3}) → '3 行' */
    function translate(key, vars) {
      let text = view.t(key)
      if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value))
      return text
    }

    /* ------------------------------------------------------------------ */
    /* 图标                                                                */
    /* ------------------------------------------------------------------ */

    const FILE_COLORS = {
      js: '#d0bf69', mjs: '#d0bf69', cjs: '#d0bf69', jsx: '#d0bf69',
      ts: '#5dd8ff', tsx: '#5dd8ff', json: '#9c86f5',
      py: '#7fc9a8', swift: '#f0905e', m: '#6fa8dc', h: '#6fa8dc', mm: '#6fa8dc',
      c: '#8fa6c2', cpp: '#8fa6c2', java: '#f0905e', kt: '#a48cf0',
      dart: '#4fc3f7', go: '#6fd3e0', rs: '#d9a066', sh: '#8fcb7a',
      yml: '#c9a0dc', yaml: '#c9a0dc', css: '#7fa8ff', scss: '#e07fb0',
      html: '#e08a5f', md: '#8fa6c2', png: '#7fc9a8', jpg: '#7fc9a8',
      jpeg: '#7fc9a8', gif: '#7fc9a8', webp: '#7fc9a8', svg: '#e0b060',
      sql: '#93a1c9', toml: '#c9a0dc', rb: '#e0565b', php: '#9c86f5', proto: '#8fa6c2',
    }

    function fileColor(name) {
      const ext = extOf(name)
      return FILE_COLORS[ext] || '#8a8a93'
    }

    function FolderGlyph({ size = 13, color }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: 'M1.5 4.2c0-.7.6-1.2 1.2-1.2h3.1c.4 0 .7.2 1 .5l.7.9h5.8c.7 0 1.2.6 1.2 1.2v6.1c0 .7-.6 1.2-1.2 1.2H2.7c-.7 0-1.2-.6-1.2-1.2V4.2Z',
          fill: color || 'currentColor',
          opacity: color ? 0.95 : 0.85,
        }),
      )
    }

    function FileGlyph({ name, size = 13 }) {
      const color = fileColor(name)
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: 'M3 2.6c0-.6.5-1.1 1.1-1.1h5.1L13 5.3v8.1c0 .6-.5 1.1-1.1 1.1H4.1c-.6 0-1.1-.5-1.1-1.1V2.6Z',
          fill: color,
          opacity: 0.92,
        }),
        h('path', { d: 'M9 1.7v3.4h3.6', fill: 'none', stroke: 'rgba(0,0,0,.35)', strokeWidth: 1.1 }),
      )
    }

    function Chevron({ open }) {
      return h(
        'svg',
        { width: 9, height: 9, viewBox: '0 0 10 10', 'aria-hidden': true },
        h('path', { d: 'M3 1.5 7.2 5 3 8.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    function PanelIcon({ size = 18, active }) {
      const color = active ? 'var(--dsw-alias-brand-primary,#0a84ff)' : 'currentColor'
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 20 20', 'aria-hidden': true },
        h('path', {
          d: 'M2.5 5.6c0-.9.7-1.6 1.6-1.6h3.7c.5 0 .9.2 1.3.6l1 1.2h6.8c.9 0 1.6.7 1.6 1.6v6.9c0 .9-.7 1.6-1.6 1.6H4.1c-.9 0-1.6-.7-1.6-1.6V5.6Z',
          fill: 'none',
          stroke: color,
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
      )
    }

    /* ------------------------------------------------------------------ */
    /* 面板                                                                */
    /* ------------------------------------------------------------------ */

    function Panel() {
      const state = useSnapshot()
      const { actions } = view
      const t = (key, vars) => translate(key, vars)
      const filterRef = useRef(null)
      const mainRef = useRef(null)

      useEffect(() => {
        actions.boot()
      }, [])

      useEffect(() => {
        const el = mainRef.current
        if (!el) return undefined
        const onKey = (event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            event.preventDefault()
            actions.save()
          }
        }
        el.addEventListener('keydown', onKey)
        return () => el.removeEventListener('keydown', onKey)
      }, [])

      const rows = state.rows || []
      const doc = state.doc

      return h(
        'div',
        { className: 'fx-root', ref: mainRef },
        h(
          'div',
          { className: 'fx-head' },
          h('div', { className: 'fx-title' }, t('title'), h('span', { className: 'fx-rootPath' }, state.root || '')),
          h(
            'div',
            { className: 'fx-headActions' },
            state.roots.length > 1
              ? h(
                  'select',
                  {
                    className: 'fx-filter',
                    style: { width: 160 },
                    value: String(state.rootIndex),
                    onChange: (event) => actions.selectRoot(Number(event.target.value)),
                    title: t('switchWorkspace'),
                  },
                  state.roots.map((root, index) => h('option', { key: root.path, value: String(index) }, root.title)),
                )
              : null,
            h('button', { className: 'fx-btn', onClick: () => actions.refresh(), title: t('refresh') }, t('refresh')),
          ),
        ),
        state.error
          ? h('div', { className: 'fx-banner err' }, h('span', null, state.error), h('button', { className: 'fx-btn', onClick: () => actions.clearError() }, '×'))
          : null,
        state.staleBanner ? h('div', { className: 'fx-banner' }, h('span', null, t('overwriteHint')), h('button', { className: 'fx-btn', onClick: () => actions.save(true) }, t('overwrite'))) : null,
        h(
          'div',
          { className: 'fx-body' },
          h(
            'div',
            { className: 'fx-treePane', style: { width: state.split } },
            h('div', { className: 'fx-treeHead' }, h('span', null, t('explorer')), h('span', { className: 'fx-count' }, rows.length ? String(rows.filter((row) => row.type === 'file').length) : '')),
            h(
              'div',
              { className: 'fx-filterWrap' },
              h('input', {
                ref: filterRef,
                className: 'fx-filter',
                placeholder: t('filter'),
                value: state.filter,
                onChange: (event) => actions.setFilter(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') actions.setFilter('')
                },
              }),
            ),
            h(
              'div',
              { className: 'fx-tree' },
              rows.length === 0
                ? h('div', { className: 'fx-notice', style: { padding: '18px 12px' } }, state.loading ? t('loading') : state.filter ? t('filterEmpty') : t('empty'))
                : rows.map((row) =>
                    h(
                      'div',
                      {
                        key: row.path,
                        className: `fx-row${row.type === 'directory' ? ' dir' : ''}${state.selected === row.path ? ' sel' : ''}`,
                        style: { paddingLeft: 8 + row.depth * 14 },
                        onClick: () => actions.activate(row),
                        title: row.path,
                      },
                      h('span', { className: `fx-chev${row.type === 'directory' && row.open ? ' open' : ''}` }, row.type === 'directory' ? h(Chevron, { open: row.open }) : null),
                      h('span', { className: 'fx-ico' }, row.type === 'directory' ? h(FolderGlyph, { color: '#4a9dec' }) : h(FileGlyph, { name: row.name })),
                      h('span', { className: 'fx-name' }, row.name),
                      row.flat
                        ? h(
                            'span',
                            { className: 'fx-rowPath' },
                            row.path.slice(state.root.length + 1).split('/').slice(0, -1).join('/'),
                          )
                        : null,
                    ),
                  ),
            ),
          ),
          h('div', {
            className: 'fx-resizer',
            title: t('splitHint'),
            onMouseDown: (event) => {
              event.preventDefault()
              const startX = event.clientX
              const startWidth = state.split
              const move = (e) => actions.setSplit(Math.max(160, Math.min(560, startWidth + (e.clientX - startX))))
              const up = () => {
                window.removeEventListener('mousemove', move)
                window.removeEventListener('mouseup', up)
              }
              window.addEventListener('mousemove', move)
              window.addEventListener('mouseup', up)
            },
          }),
          h(
            'div',
            { className: 'fx-main' },
            doc
              ? h(
                  'div',
                  { className: 'fx-fileHead' },
                  doc.dirty ? h('span', { className: 'fx-dot', title: t('unsaved') }) : null,
                  h('span', { className: 'fx-fileName' }, baseName(doc.path)),
                  h('span', { className: 'fx-filePath' }, dirName(doc.path)),
                  h(
                    'div',
                    { className: 'fx-fileActions' },
                    h('span', { className: 'fx-filePath' }, doc.dirty ? t('unsaved') : t('saved')),
                    doc.kind === 'text' && doc.dirty
                      ? h('button', { className: 'fx-btn primary', disabled: state.saving, onClick: () => actions.save() }, state.saving ? '…' : t('save'))
                      : null,
                  ),
                )
              : null,
            doc && doc.kind === 'text' ? h(Editor, { doc, actions }) : null,
            doc && doc.kind === 'image' ? h('div', { className: 'fx-imageWrap' }, h('img', { src: doc.dataUrl, alt: t('imageAlt') })) : null,
            doc && doc.kind === 'binary' ? h('div', { className: 'fx-notice' }, t('binary')) : null,
            doc && doc.kind === 'too-large' ? h('div', { className: 'fx-notice' }, t('tooLarge', { size: formatBytes(doc.size) })) : null,
            !doc
              ? h(
                  'div',
                  { className: 'fx-notice' },
                  state.loading ? t('loading') : state.roots.length ? t('pickFile') : t('noWorkspace'),
                )
              : null,
            h(
              'div',
              { className: 'fx-status' },
              h('span', null, doc && doc.kind === 'text' ? (LANG_LABEL[doc.lang] || extOf(doc.path) || 'text') : ''),
              doc && doc.kind === 'text' ? h('span', null, t('lines', { count: doc.lines })) : null,
              doc && doc.size ? h('span', null, formatBytes(doc.size)) : null,
              doc && doc.kind === 'text' ? h('span', null, 'UTF-8') : null,
              h('span', { className: 'fx-spacer' }),
              doc && doc.kind === 'text' ? h('span', null, `${state.cursor.line}:${state.cursor.col}`) : null,
            ),
          ),
        ),
      )
    }

    /** 编辑器：gutter + 高亮层 + 透明 textarea。 */
    function Editor({ doc, actions }) {
      const taRef = useRef(null)
      const hlRef = useRef(null)
      const gutterRef = useRef(null)
      const [html, setHtml] = useState(() => highlight(doc.text, doc.lang || langOf(doc.path, doc.text)))

      // 高亮跟着文本走，但打字时不要每个字符都重排整篇：60ms 去抖。
      useEffect(() => {
        const id = window.setTimeout(() => setHtml(highlight(doc.text, doc.lang || langOf(doc.path, doc.text))), 60)
        return () => window.clearTimeout(id)
      }, [doc.text, doc.path])

      const sync = useCallback(() => {
        const ta = taRef.current
        if (!ta) return
        if (hlRef.current) {
          hlRef.current.scrollTop = ta.scrollTop
          hlRef.current.scrollLeft = ta.scrollLeft
        }
        if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`
      }, [])

      useEffect(() => {
        sync()
      }, [doc.path, sync])

      const reportCursor = useCallback(() => {
        const ta = taRef.current
        if (!ta) return
        const upto = ta.value.slice(0, ta.selectionStart)
        const line = upto.split('\n').length
        const col = upto.length - upto.lastIndexOf('\n')
        actions.setCursor(line, col)
      }, [])

      useEffect(() => {
        const ta = taRef.current
        if (ta) {
          ta.selectionStart = 0
          ta.selectionEnd = 0
          ta.scrollTop = 0
          sync()
          reportCursor()
        }
      }, [doc.path])

      const numbers = useMemo(() => {
        const out = []
        for (let i = 1; i <= doc.lines; i += 1) out.push(String(i))
        return out.join('\n')
      }, [doc.lines])

      return h(
        'div',
        { className: 'fx-editorWrap' },
        h('div', { className: 'fx-gutter' }, h('div', { className: 'fx-gutterInner', ref: gutterRef }, numbers)),
        h(
          'div',
          { className: 'fx-code' },
          h('pre', { className: 'fx-hl', ref: hlRef, 'aria-hidden': true, dangerouslySetInnerHTML: { __html: html + '\n' } }),
          h('textarea', {
            ref: taRef,
            className: 'fx-input',
            value: doc.text,
            spellCheck: false,
            autoCorrect: 'off',
            autoCapitalize: 'off',
            wrap: 'off',
            onChange: (event) => {
              actions.edit(event.target.value)
              reportCursor()
            },
            onScroll: sync,
            onKeyUp: reportCursor,
            onClick: reportCursor,
            onSelect: reportCursor,
            onKeyDown: (event) => {
              if (event.key === 'Tab') {
                event.preventDefault()
                const ta = event.target
                const start = ta.selectionStart
                const end = ta.selectionEnd
                const next = `${ta.value.slice(0, start)}  ${ta.value.slice(end)}`
                actions.edit(next)
                window.requestAnimationFrame(() => {
                  ta.selectionStart = start + 2
                  ta.selectionEnd = start + 2
                })
              }
            },
          }),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* 控制器                                                              */
    /* ------------------------------------------------------------------ */

    const inject = ['slots', 'locale']

    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.setAttribute('data-dsh-file-explorer', '')
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'dsh-file-explorer: styles')

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-file-explorer: dictionaries')
      view.t = ctx.locale.bind(NS)

      const store = createStore({
        roots: [],
        rootIndex: 0,
        root: '',
        children: {},
        open: {},
        filter: '',
        selected: null,
        rows: [],
        doc: null,
        loading: false,
        saving: false,
        error: null,
        staleBanner: false,
        split: 260,
        cursor: { line: 1, col: 1 },
      })
      view.store = store

      async function api(action, payload) {
        const response = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...(payload || {}) }),
        })
        let data = null
        try {
          data = await response.json()
        } catch {
          data = null
        }
        if (!data || data.ok !== true) {
          const error = new Error((data && data.error) || `HTTP ${response.status}`)
          // 保留服务端的附加信息（比如 stale 标记），界面上要用它决定是提示还是报错。
          error.payload = data
          throw error
        }
        return data
      }

      /** 递归展开成扁平行；只走「已展开」的分支。 */
      function buildRows(state) {
        const rows = []
        const needle = state.filter.trim().toLowerCase()
        // 有筛选时用宿主返回的递归结果，不再从「已展开」的分支里凑。
        if (needle && Array.isArray(state.found)) return state.found
        const walk = (dir, depth) => {
          for (const child of state.children[dir] || []) {
            const path = joinPath(dir, child.name)
            const open = !!state.open[path]
            if (!needle || child.name.toLowerCase().includes(needle) || open) {
              rows.push({ path, name: child.name, type: child.type, depth, open })
            }
            if (child.type === 'directory' && open && !needle) walk(path, depth + 1)
          }
        }
        walk(state.root, 0)
        return rows
      }

      let filterTimer = null

      const actions = {
        async boot() {
          try {
            const data = await api('roots')
            const roots = data.roots || []
            if (!roots.length) {
              store.set({ roots: [], root: '', error: translate('noWorkspace') })
              return
            }
            const index = Math.max(0, Math.min(roots.length - 1, Number(data.index) || 0))
            store.set({ roots, rootIndex: index, root: roots[index].path })
            await actions.loadDir(roots[index].path)
            store.set((state) => ({ rows: buildRows(state) }))
          } catch (error) {
            store.set({ error: String(error && error.message) })
          }
        },
        async selectRoot(index) {
          const root = store.get().roots[index]
          if (!root) return
          store.set({ rootIndex: index, root: root.path, children: {}, open: {}, selected: null, doc: null, filter: '' })
          await actions.loadDir(root.path)
          store.set((state) => ({ rows: buildRows(state) }))
        },
        async loadDir(path) {
          const { root } = store.get()
          store.set({ loading: true })
          try {
            const data = await api('list', { root, path })
            store.set((state) => ({
              loading: false,
              children: { ...state.children, [path]: data.entries },
            }))
          } catch (error) {
            store.set({ loading: false, error: `${translate('listFailed')}: ${String(error && error.message)}` })
          }
        },
        async activate(row) {
          if (row.type === 'directory') {
            const state = store.get()
            const open = { ...state.open }
            const willOpen = !open[row.path]
            if (willOpen) open[row.path] = true
            else delete open[row.path]
            store.set({ open })
            if (willOpen && !state.children[row.path]) await actions.loadDir(row.path)
            store.set((current) => ({ rows: buildRows(current) }))
            return
          }
          await actions.openFile(row.path)
        },
        async openFile(path) {
          const current = store.get().doc
          if (current && current.dirty) {
            const discard = typeof window.confirm === 'function'
              ? window.confirm(`${baseName(current.path)} 还没保存，确定切换吗？`)
              : true
            if (!discard) return
          }
          const { root } = store.get()
          store.set({ selected: path, loading: true, staleBanner: false })
          try {
            if (IMAGE_EXT.has(extOf(path))) {
              const data = await api('image', { root, path })
              store.set({
                loading: false,
                doc: { path, kind: 'image', dataUrl: `data:${data.mime};base64,${data.base64}`, size: data.size, dirty: false },
              })
              return
            }
            const data = await api('read', { root, path })
            if (data.kind !== 'text') {
              store.set({ loading: false, doc: { path, kind: data.kind, size: data.size, dirty: false } })
              return
            }
            store.set({
              loading: false,
              doc: {
                path,
                kind: 'text',
                lang: langOf(path, data.text),
                text: data.text,
                saved: data.text,
                version: data.version,
                size: data.size,
                lines: data.text.split('\n').length,
                dirty: false,
              },
              cursor: { line: 1, col: 1 },
            })
          } catch (error) {
            store.set({ loading: false, error: `${translate('openFailed')}: ${String(error && error.message)}` })
          }
        },
        edit(text) {
          const doc = store.get().doc
          if (!doc || doc.kind !== 'text') return
          store.set({ doc: { ...doc, text, lines: text.split('\n').length, dirty: text !== doc.saved } })
        },
        async save(force) {
          const state = store.get()
          const doc = state.doc
          if (!doc || doc.kind !== 'text' || state.saving) return
          if (!force && !doc.dirty) return
          store.set({ saving: true, error: null })
          try {
            const data = await api('write', {
              root: state.root,
              path: doc.path,
              text: doc.text,
              version: force ? undefined : doc.version,
            })
            store.set((current) => ({
              saving: false,
              staleBanner: false,
              doc: current.doc ? { ...current.doc, saved: current.doc.text, version: data.version, size: data.bytes, dirty: false } : null,
            }))
          } catch (error) {
            const message = String(error && error.message)
            const stale = !!(error && error.payload && error.payload.stale) || /stale|版本|version/i.test(message)
            store.set({
              saving: false,
              staleBanner: stale && !force,
              error: stale && force ? `${translate('saveFailed')}: ${message}` : stale ? null : `${translate('saveFailed')}: ${message}`,
            })
          }
        },
        refresh() {
          const { root, children } = store.get()
          if (!root) return
          const dirs = Object.keys(children)
          return Promise.all(dirs.map((dir) => actions.loadDir(dir))).then(() => store.set((state) => ({ rows: buildRows(state) })))
        },
        setFilter(filter) {
          store.set({ filter })
          if (filterTimer) window.clearTimeout(filterTimer)
          const needle = filter.trim()
          if (!needle) {
            store.set((state) => ({ found: null, rows: buildRows(state) }))
            return
          }
          filterTimer = window.setTimeout(async () => {
            const { root } = store.get()
            if (!root) return
            store.set({ searching: true })
            try {
              const data = await api('search', { root, query: needle })
              const found = (data.entries || []).map((entry) => ({
                path: entry.path,
                name: entry.name,
                type: entry.type,
                depth: 0,
                open: false,
                flat: true,
              }))
              store.set((state) => ({ searching: false, found, rows: state.filter.trim() ? found : buildRows(state) }))
            } catch (error) {
              store.set({ searching: false, error: `${translate('searchFailed')}: ${String(error && error.message)}` })
            }
          }, 180)
        },
        setSplit(split) {
          store.set({ split })
        },
        setCursor(line, col) {
          store.set({ cursor: { line, col } })
        },
        clearError() {
          store.set({ error: null })
        },
      }

      view.actions = actions

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: SLOT_ID, order: 20, label: () => view.t('title'), locale: NS },
          PanelIcon,
        ),
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: SLOT_ID }, Panel),
      )
    }

    // highlight 只给本地单测 / 截图核对用，加载器只读 inject 和 apply。
    return { inject, apply, highlight }
  },
})
