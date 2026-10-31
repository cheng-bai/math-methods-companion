#!/usr/bin/env python3
"""Build the portable public reader from an explicit catalog and original demos."""
from argparse import ArgumentParser
from collections import OrderedDict
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import shutil
import subprocess
from knowledge import page as knowledge_page, validate as validate_knowledge
from example_links import validate as validate_example_links

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_CSS = '''.public-catalog-item{display:grid;gap:6px;background:var(--sheet);padding:16px;border:1px solid var(--line);font:13px/1.5 var(--sans)}.public-catalog-item[hidden],.catalog-volume[hidden]{display:none}.public-catalog-item b{font:12px Georgia,serif;color:var(--teal)}.public-catalog-item small{font:11px var(--sans);color:var(--muted)}.chapter-link small{display:block;color:var(--muted);font-size:10px}.catalog-filter{display:flex;flex-wrap:wrap;gap:8px;align-items:end;font:13px/1.5 var(--sans)}.catalog-filter label{display:grid;gap:5px;flex:1 1 250px}.catalog-filter input{width:100%;height:40px;padding:0 10px;border:1px solid #aabfb3;background:var(--sheet);color:var(--ink)}.catalog-filter button{height:40px;padding:0 14px;border:1px solid #aabfb3;background:#eef5ec;color:var(--forest)}.catalog-status{margin:8px 0 16px;color:var(--muted);font:12px/1.5 var(--sans)}'''


def h(value):
    return escape(str(value), quote=True)


def markdown(value):
    return subprocess.run(
        ['pandoc', '-f', 'commonmark+tex_math_dollars', '--mathjax', '-t', 'html5'],
        input=value, capture_output=True, text=True, check=True).stdout


def head(title, chapter=False):
    prefix = '../' if chapter else ''
    scripts = (f'<link rel="stylesheet" href="{prefix}assets/katex/katex.min.css">'
               f'<script defer src="{prefix}assets/katex/katex.min.js"></script>'
               f'<script defer src="{prefix}assets/site.js"></script>') if chapter else '<script defer src="assets/search.js"></script>'
    return (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{h(title)}</title><link rel="stylesheet" href="{prefix}assets/site.css">'
            f'<link rel="stylesheet" href="{prefix}assets/public.css">{scripts}</head>')


def brand(prefix=''):
    return (f'<a class="brand" href="{prefix}index.html"><span class="brand-symbol">M<span>·</span></span>'
            '<span><b>数学方法研究</b><small>THE METHODS COMPANION</small></span></a>')


def sidebar(catalog, demo, edition):
    volumes = OrderedDict()
    for chapter in catalog:
        volumes.setdefault(chapter['volume'], []).append(chapter)
    parts = []
    for i, (volume, chapters) in enumerate(volumes.items(), 1):
        active = volume == demo['volume']
        links = ''.join(f'<span class="chapter-link"><span>{h(c["id"])}</span><span>{h(c["title"])}<small> · 正文暂未公开</small></span></span>' for c in chapters)
        if active:
            links = (f'<a class="chapter-link active" href="{h(demo["id"])}-{edition}.html"><span>公开演示</span>'
                     f'<span>{h(demo["title"])}</span></a>') + links
        parts.append(f'<details class="volume"{" open" if active else ""}><summary><span class="volume-number">{i:02}</span>'
                     f'<span>{h(volume.split(" ", 1)[-1])}</span><small>{len(chapters)}讲目录</small></summary><div class="chapters">{links}</div></details>')
    return ''.join(parts)


def question_card(q, type_anchor, edition, related_ids=(), knowledge_links=()):
    anchor = q['id'].lower()
    stem = markdown(q['stem'])
    solution = ''
    if edition == 'teacher':
        solution = ('<details class="solution"><summary>展开答案与解析</summary>'
                    + markdown('**答案**　' + q['answer'] + '\n\n**解析**\n\n' + q['solution']
                               + '\n\n**取等检查**\n\n' + q['equality'])
                    + '<div class="note note-tip">' + markdown('**解题笔记**　' + q['note']) + '</div></details>')
    title = h(q['title']) if edition == 'teacher' else '自编教学演示'
    search = h(q['id'] + ' ' + q['title'] + ' ' + q['stem'])
    related = ''.join(f'<a href="#{h(qid.lower())}">{h(qid)}</a>' for qid in related_ids if qid != q['id'])
    related_nav = f'<nav class="question-related" aria-label="同题型例训"><span>同题型：</span>{related}</nav>' if related else ''
    back_links = ''.join(f'<a href="../knowledge.html#{h(row["card_id"])}">{h(row["title"].replace("$", ""))} ↗</a><span>{h(row["focus"])}</span>' for row in knowledge_links)
    back_nav = f'<nav class="question-knowledge" aria-label="对应知识卡"><strong>回看知识 · 本题对应动作</strong>{back_links}</nav>' if back_links else ''
    return (f'<section class="question" id="{anchor}" data-role="{h(q.get("role", "自编演示"))}" data-difficulty="未标定" data-search="{search.lower()}">'
            f'<h4>{h(q["id"])}　{title}</h4><div class="question-context"><a class="question-type-link" href="#{type_anchor}">'
            f'题型入口：{h(q["type_title"])}</a>{related_nav}</div>{stem}<p class="source-line">{h(q.get("role", "自编演示"))} · 未作难度标定</p>{back_nav}{solution}</section>')


def validate_demo(demo):
    """Require unique normalized question anchors and persistent type identities."""
    question_ids, identities, names = set(), {}, {}
    for q in demo['questions']:
        qid = q['id'].lower()
        if not re.fullmatch(r'q[0-9]+', qid) or qid in question_ids:
            raise ValueError(f"无效或重复的题号锚点: {q['id']}")
        question_ids.add(qid)
        type_id = q['type_id']
        if not re.fullmatch(r'[a-z][a-z0-9-]*', type_id) or type_id == 'map':
            raise ValueError(f'无效的稳定题型ID: {type_id}')
        name = (q['type_family'], q['type_title'])
        if type_id in identities and identities[type_id] != name:
            raise ValueError(f'同一题型ID对应不同分类: {type_id}')
        if name in names and names[name] != type_id:
            raise ValueError(f'同一分类对应不同题型ID: {name}')
        identities[type_id], names[name] = name, type_id
    for legacy, type_id in demo.get('legacy_type_anchors', {}).items():
        if not re.fullmatch(r'type-[0-9]+-[0-9]+', legacy) or type_id not in identities:
            raise ValueError(f'旧题型锚点映射无效: {legacy} -> {type_id}')


def chapter_page(catalog, demo, edition, example_links=(), knowledge=None):
    teacher = edition == 'teacher'
    label = '教师版' if teacher else '学生版'
    other = 'student' if teacher else 'teacher'
    other_label = '学生版' if teacher else '教师版'
    validate_demo(demo)
    qs = demo['questions']
    card_titles = {c['id']: c['title'] for c in knowledge['cards']} if knowledge else {}
    # Keep the first appearance order; a fine type is scoped to its family.
    families = OrderedDict()
    for q in qs:
        families.setdefault(q['type_family'], OrderedDict()).setdefault(q['type_title'], []).append(q)
    anchors = {}
    group_html = []
    for i, (family, types) in enumerate(families.items(), 1):
        type_html = []
        for j, (title, items) in enumerate(types.items(), 1):
            type_id = items[0]['type_id']
            anchor = f'type-{type_id}'
            aliases = ''.join(f'<span id="{h(legacy)}"></span>' for legacy, target in demo.get('legacy_type_anchors', {}).items() if target == type_id)
            for q in items:
                anchors[q['id']] = anchor
            links = ''.join(f'<a href="#{h(q["id"].lower())}"><b>{h(q["id"])}</b><span>{h(q["title"])}</span></a>' for q in items)
            type_html.append(f'<div class="type-group" id="{anchor}">{aliases}<div><h4>{h(title)}</h4><p class="type-hint">{h(items[0]["type_note"])}</p>'
                             f'<span class="type-count">{len(items)}道自编演示 · 未作难度标定</span></div><div class="type-links">{links}</div></div>')
        group_html.append(f'<details class="type-family"{" open" if i == 1 else ""}><summary><span class="family-number">{i:02}</span>'
                          f'<span><strong>{h(family)}</strong></span><span class="family-count">{len(types)}类</span></summary>'
                          f'<div class="family-body">{"".join(type_html)}</div></details>')
    groups = ''.join(group_html)
    cards = ''.join(question_card(q, anchors[q['id']], edition,
                                 [other['id'] for other in qs if other['type_id'] == q['type_id']],
                                 [row | {'title': card_titles[row['card_id']]} for row in example_links if row['question_id'] == q['id']]) for q in qs)
    toggler = '<button type="button" class="toggle-solutions" aria-pressed="false">展开全部解析</button>' if teacher else ''
    questions = ''.join(f'<a href="#{q["id"].lower()}">{h(q["id"])}</a>' for q in qs)
    volume_count = len({c['volume'] for c in catalog})
    body = f'''<body id="top"><div class="reading-progress" aria-hidden="true"><span></span></div>
<header class="topbar"><button class="menu-toggle" aria-expanded="false" aria-controls="book-nav">☰ <span>全书目录</span></button>{brand('../')}<div class="top-right"><span class="edition">{label} · 公开演示</span><a href="{demo['id']}-{other}.html">切换{other_label} ↗</a></div></header>
<div class="backdrop" hidden></div><div class="layout"><aside class="sidebar" id="book-nav" aria-label="全书目录"><div class="side-head"><div><span class="eyebrow">THE COMPLETE MAP</span><h2>全书结构</h2><p>{volume_count}个板块 · {len(catalog)}讲目录</p></div><button class="menu-close" aria-label="关闭目录">×</button></div><div class="position"><span>当前位置</span><strong>{h(demo['volume'])}</strong><small>公开演示 · 基本不等式</small></div><nav class="book-tree">{sidebar(catalog, demo, edition)}</nav><p class="side-foot">目录元数据不是知识覆盖证明。未公开章不提供正文链接。</p></aside>
<main><div class="breadcrumbs"><a href="../index.html">全书</a><span>/</span><button type="button" class="jump-to-volume">{h(demo['volume'])}</button><span>/</span><b>公开演示</b></div><div class="main-grid"><div class="reading-column"><section class="hero"><div class="hero-top"><span>PUBLIC DEMONSTRATION</span><span>{h(demo['id'])}</span></div><div class="hero-body"><div><div class="hero-kicker">自编教学演示 · {label}</div><h1>{h(demo['title'])}</h1><p>{h(demo['notice'])}</p><div class="hero-stats"><span><b>{len(qs):02}</b> 公开演示</span><span><b>未标定</b> 难度</span></div></div></div></section>
<section class="tools" aria-label="题目筛选"><div class="tools-heading"><div><span class="eyebrow">READ YOUR WAY</span><h2>按你的节奏阅读</h2></div><span class="live-count" aria-live="polite">{len(qs)} / {len(qs)} 题块</span></div><div class="tool-row"><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="搜索演示题号或题干" aria-label="搜索演示题号或题干"></label><div class="filters" role="group" aria-label="题目筛选"><button data-filter="all" aria-pressed="true">全部演示</button></div>{toggler}</div><p class="tool-note">学生版没有答案解析，但保留方法分类提示，不是无提示测试卷。</p></section>
<section class="type-map" id="type-map"><span class="eyebrow">QUESTION TYPES</span><h2>演示题型地图</h2><p>{len(qs)}道独立教学示例，不代表基本不等式的完整题型。</p>{groups}</section><article class="book-content"><h2 id="overview">整体把握</h2>{markdown(demo['overview'])}<h2 id="examples">自编教学演示</h2>{cards}</article><footer class="page-footer"><a href="../index.html">← 返回公开首页</a></footer></div>
<aside class="chapter-rail"><div class="rail-inner"><span class="eyebrow">IN THIS CHAPTER</span><h2>本讲大纲</h2><button class="outline-toggle" aria-expanded="false">展开本讲大纲与题号 ↓</button><div class="rail-content"><nav class="outline"><a href="#type-map">题型地图</a><a href="#overview">整体把握</a><a href="#examples">自编演示</a></nav><div class="rail-rule"></div><div class="rail-question-title"><b>题号直达</b></div><nav class="question-index" aria-label="题号直达">{questions}</nav></div></div></aside></div></main></div>'''
    meta = {'id': demo['id'], 'edition': edition, 'questions': len(qs), 'content': '自编教学演示，未作难度标定'}
    return head(demo['title'] + '｜' + label, True) + body + '<script type="application/json" id="source-meta">' + json.dumps(meta, ensure_ascii=False).replace('<', '\\u003c') + '</script></body></html>'


def homepage(catalog, demo, knowledge=None):
    volumes = OrderedDict()
    for c in catalog:
        volumes.setdefault(c['volume'], []).append(c)
    sections = []
    for volume, chapters in volumes.items():
        cards = ''.join(f'<div class="public-catalog-item"><b>{h(c["id"])}</b><span>{h(c["title"])}</span><small>正文暂未公开</small></div>' for c in chapters)
        sections.append(f'<section class="home-volume catalog-volume"><h2>{h(volume)}</h2><div class="home-cards">{cards}</div></section>')
    volume_options = ''.join(f'<option value="{h(v)}">{h(v)}</option>' for v in volumes)
    knowledge_volumes = '、'.join(dict.fromkeys(card['volume'].split(' ', 1)[1] for card in knowledge['cards'])) if knowledge else ''
    knowledge_entry = (f'<section class="home-volume"><h2>先查知识，再找方法</h2><div class="home-cards"><a href="knowledge.html"><b>编者知识速查</b><span>{len(knowledge["cards"])}张已复核知识卡</span><small>{h(knowledge_volumes)} · 公式、识别信号和易错边界 · 非完整覆盖</small></a></div></section>') if knowledge else ''
    return head('高中数学解析字典 · 公开演示') + f'''<body><header class="topbar">{brand()}<span class="edition">便携公开演示</span></header><main class="home"><section class="home-intro"><span class="eyebrow">A MATHEMATICS COMPANION</span><h1>高中数学<br>解析字典</h1><p>从条件出发，找到方法，检查边界。这里展示编者知识速查、完整目录元数据和自编教学演示；不包含私人题库正文或原题图。</p><div class="home-stats"><span><b>{len(volumes)}</b> 个板块</span><span><b>{len(catalog)}</b> 讲目录</span><span><b>{len(demo['questions'])}</b> 道公开演示</span></div></section><p class="home-notice">目录是全书位置提示，不是知识覆盖证明。以下原有章节正文暂未公开；另可阅读编者知识速查和单列的{len(demo['questions'])}道自编演示；演示题未作难度标定。</p>
{knowledge_entry}<section class="home-volume"><h2>先读一个公开演示</h2><div class="home-cards"><a href="chapters/{demo['id']}-teacher.html"><b>教师版</b><span>{h(demo['title'])}</span><small>{len(demo['questions'])}道自编演示 · 含答案、关键理由与取等检查</small></a><a href="chapters/{demo['id']}-student.html"><b>学生版</b><span>{h(demo['title'])}</span><small>只含题目及方法导航 · 不含解析</small></a></div></section>
<section class="global-search" aria-label="公开演示检索"><span class="eyebrow">SEARCH THE DEMOS</span><h2>查找公开演示</h2><label for="global-query">这里只检索{len(demo['questions'])}道自编教学演示，不检索未公开正文</label><input type="search" id="global-query" placeholder="例如：定和、分母、Q01" autocomplete="off"><div class="search-controls"><label>板块<select id="search-volume"><option value="">全部板块</option>{volume_options}</select></label><label>类型<select id="search-role"><option value="">全部类型</option><option>自编演示</option></select></label><label>难度<select id="search-difficulty"><option value="">全部难度</option><option>未标定</option></select></label><label>跳转版本<select id="search-edition"><option value="teacher">教师版</option><option value="student">学生版</option></select></label><button type="button" id="search-all">浏览全部演示</button></div><p id="search-status" aria-live="polite">输入关键词或选择条件检索；也可浏览全部演示。</p><div id="search-results"></div><div class="search-pagination" hidden><button type="button" id="search-prev">上一页</button><span id="search-page"></span><button type="button" id="search-next">下一页</button></div></section>
<div class="home-heading" id="catalogue"><div><span class="eyebrow">CATALOG ONLY</span><h2>全书位置与知识架构</h2></div><p>{len(volumes)}板块 / {len(catalog)}讲目录 · 非正文公开清单</p></div><div class="catalog-filter"><label for="catalog-query">筛选目录（章节编号、名称或板块；空格分词）<input type="search" id="catalog-query" placeholder="例如：B09 复数" autocomplete="off"></label><button type="button" id="catalog-clear">清除目录筛选</button></div><p class="catalog-status" id="catalog-status" role="status">显示全部 {len(catalog)} 讲目录；正文暂未公开。</p>{''.join(sections)}</main></body></html>'''


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()
        self.duplicate_ids = set()
        self.solutions = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                self.duplicate_ids.add(attrs['id'])
            self.ids.add(attrs['id'])
        for key in ('src', 'href'):
            if attrs.get(key):
                self.links.append(attrs[key])
        if tag == 'details' and 'solution' in attrs.get('class', '').split():
            self.solutions += 1


def check(output, allow_missing_assets, question_count):
    errors, missing_assets = [], []
    pages = sorted(output.rglob('*.html'))
    parsers = {}
    for page in pages:
        data = page.read_text()
        parser = References()
        parser.feed(data)
        parsers[page.resolve()] = parser
        if parser.duplicate_ids:
            errors.append(f'{page.name}: 重复的HTML ID: ' + ', '.join(sorted(parser.duplicate_ids)))
        if re.search(r'file:|/Users/|/home/|[A-Za-z]:\\\\', data):
            errors.append(f'{page.name}: 检出本机路径')
        if '-student.html' in page.name and parser.solutions:
            errors.append(f'{page.name}: 学生版出现解析块')
    for page in pages:
        for link in parsers[page.resolve()].links:
            split = urlsplit(link)
            if split.scheme or split.netloc or link.startswith('/'):
                errors.append(f'{page.name}: 非便携链接 {link}')
                continue
            target = (page.parent / unquote(split.path)).resolve() if split.path else page.resolve()
            if not target.is_relative_to(output.resolve()):
                errors.append(f'{page.name}: 链接越出输出目录 {link}')
            elif not target.is_file():
                if target.is_relative_to((output / 'assets').resolve()):
                    missing_assets.append(link)
                else:
                    errors.append(f'{page.name}: 目标文件缺失 {link}')
            elif split.fragment and target.suffix == '.html' and split.fragment not in parsers.get(target, References()).ids:
                errors.append(f'{page.name}: 锚点缺失 {link}')
    for data_file in (ROOT / 'content').glob('*.json'):
        data = data_file.read_text()
        if re.search(r'file:|/Users/|/home/', data):
            errors.append(f'{data_file.name}: 检出本机路径')
    if missing_assets and not allow_missing_assets:
        errors.append('静态运行资源缺失：' + ', '.join(sorted(set(missing_assets))))
    report = {'pages': len(pages), 'public_demo_questions': question_count, 'errors': errors,
              'missing_assets': sorted(set(missing_assets)), 'asset_check_waived': bool(missing_assets and allow_missing_assets)}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--allow-missing-assets', action='store_true', help='仅用于资产暂未放入时的模板检查，不代表可上线')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'content/catalog.json').read_text())
    demo = json.loads((ROOT / 'content/demo.json').read_text())
    knowledge = json.loads((ROOT / 'content/knowledge.json').read_text())
    example_links = json.loads((ROOT / 'content/example-links.json').read_text())
    assert all(set(c) == {'id', 'title', 'volume'} for c in catalog), '目录仅允许三项元数据'
    assert len({c['id'] for c in catalog}) == len(catalog)
    validate_demo(demo)
    validate_knowledge(knowledge, catalog)
    validate_example_links(example_links, knowledge, demo)
    output = args.output.resolve()
    (output / 'chapters').mkdir(parents=True, exist_ok=True)
    (output / 'assets').mkdir(exist_ok=True)
    for name in ('LICENSE', 'THIRD_PARTY.md'):
        shutil.copy2(ROOT / name, output / name)
    for name in ('site.css', 'site.js', 'search.js', 'knowledge.css', 'knowledge.js'):
        staged = ROOT / 'assets' / name
        if staged.is_file():
            shutil.copy2(staged, output / 'assets' / name)
    if (ROOT / 'assets/katex').is_dir():
        shutil.copytree(ROOT / 'assets/katex', output / 'assets/katex', dirs_exist_ok=True)
    for edition in ('teacher', 'student'):
        (output / 'chapters' / f'{demo["id"]}-{edition}.html').write_text(chapter_page(catalog, demo, edition, example_links, knowledge))
    (output / 'index.html').write_text(homepage(catalog, demo, knowledge))
    (output / 'knowledge.html').write_text(knowledge_page(knowledge, catalog, markdown, brand, example_links, demo['id']))
    (output / 'assets/public.css').write_text(PUBLIC_CSS)
    index = []
    for q in demo['questions']:
        index.append({key: q[key] for key in ('id', 'title', 'role', 'difficulty', 'stem', 'type_family', 'type_title', 'type_note')}
                     | {'chapter': demo['id'], 'chapter_title': demo['title'], 'volume': demo['volume'], 'method': q['type_title'], 'submethod': ''})
    (output / 'assets/search-index.js').write_text('window.BOOK_SEARCH_INDEX=' + json.dumps(index, ensure_ascii=False, separators=(',', ':')) + ';')
    print('公开阅读器已生成；原题正文、原图及私有映射不在输入范围。')
    check(output, args.allow_missing_assets, len(demo['questions']))


if __name__ == '__main__':
    main()
